import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { createPaginatedResponse } from '../common/interfaces/pagination.interface';
import { CacheService } from '../common/services/cache.service';
import { AuditService } from '../common/services/audit.service';

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  async createReturn(dto: CreateReturnDto, createdByUserId?: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: dto.saleId },
      select: {
        id: true,
        status: true,
        items: { include: { product: true } },
        customer: true,
      },
    });

    if (!sale) {
      throw new NotFoundException(`Venta con id ${dto.saleId} no encontrada.`);
    }

    if (sale.status === 'CANCELLED') {
      throw new BadRequestException(
        'No se puede registrar devolución de una venta cancelada.',
      );
    }

    // Cantidad ya devuelta por producto en esta venta
    const returnedByProduct = await this.prisma.saleReturnItem.groupBy({
      by: ['productId'],
      where: { saleReturn: { saleId: dto.saleId } },
      _sum: { qty: true },
    });
    const returnedMap = new Map(
      returnedByProduct.map((r) => [r.productId, r._sum.qty ?? 0]),
    );

    let subtotal = 0;
    let taxTotal = 0;
    const returnItems: Array<{
      productId: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (const it of dto.items) {
      const saleItem = sale.items.find((i) => i.productId === it.productId);
      if (!saleItem) {
        throw new BadRequestException(
          `El producto ${it.productId} no pertenece a la venta ${dto.saleId}.`,
        );
      }
      const alreadyReturned = returnedMap.get(it.productId) ?? 0;
      const maxReturnable = saleItem.qty - alreadyReturned;
      if (it.qty > maxReturnable) {
        const productName = saleItem.product?.name ?? it.productId;
        throw new BadRequestException(
          `Cantidad a devolver de "${productName}" supera lo vendido. Vendido: ${saleItem.qty}, ya devuelto: ${alreadyReturned}, máximo a devolver: ${maxReturnable}.`,
        );
      }
      const unitPrice = Number(saleItem.unitPrice);
      const lineTotal = unitPrice * it.qty;
      const lineTax = (lineTotal * Number(saleItem.taxRate ?? 0)) / 100;
      subtotal += lineTotal;
      taxTotal += lineTax;
      returnItems.push({
        productId: it.productId,
        qty: it.qty,
        unitPrice,
        lineTotal: lineTotal + lineTax,
      });
    }

    const grandTotal = subtotal + taxTotal;

    const saleReturn = await this.prisma.$transaction(async (tx) => {
      const ret = await tx.saleReturn.create({
        data: {
          saleId: dto.saleId,
          reason: dto.reason ?? null,
          subtotal,
          taxTotal,
          grandTotal,
          items: {
            create: returnItems.map((i) => ({
              productId: i.productId,
              qty: i.qty,
              unitPrice: i.unitPrice,
              lineTotal: i.lineTotal,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          sale: { include: { customer: true } },
        },
      });

      for (const it of returnItems) {
        await tx.stockBalance.upsert({
          where: { productId: it.productId },
          create: {
            productId: it.productId,
            qtyOnHand: it.qty,
            qtyReserved: 0,
          },
          update: { qtyOnHand: { increment: it.qty } },
        });
      }

      return ret;
    });

    await this.audit.logCreate('saleReturn', saleReturn.id, createdByUserId, {
      saleId: dto.saleId,
      grandTotal: Number(saleReturn.grandTotal),
      itemsCount: saleReturn.items.length,
    });
    await this.cache.deletePattern('cache:returns:*');
    await this.cache.deletePattern('cache:sales:*');

    this.logger.log(
      `Devolución creada: ${saleReturn.id}, Venta: ${dto.saleId}, Total: ${grandTotal}`,
    );
    return saleReturn;
  }

  async listReturns(pagination?: { page?: number; limit?: number }) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.saleReturn.findMany({
        orderBy: { returnedAt: 'desc' },
        include: {
          items: { include: { product: true } },
          sale: { include: { customer: true } },
        },
        skip,
        take: limit,
      }),
      this.prisma.saleReturn.count(),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async getReturnById(id: string) {
    const saleReturn = await this.prisma.saleReturn.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        sale: { include: { customer: true, items: true } },
      },
    });

    if (!saleReturn) {
      throw new NotFoundException(`Devolución con id ${id} no encontrada.`);
    }

    return saleReturn;
  }
}
