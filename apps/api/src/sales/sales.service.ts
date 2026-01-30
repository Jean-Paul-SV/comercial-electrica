import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DianDocumentStatus,
  DianDocumentType,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';
import { CacheService } from '../common/services/cache.service';

function makeInvoiceNumber(now = new Date()) {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `INV-${yyyy}${mm}${dd}-${rand}`;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('dian') private readonly dianQueue: Queue,
    private readonly limits: ValidationLimitsService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  async createSale(dto: CreateSaleDto, createdByUserId?: string) {
    this.logger.log(
      `Creando venta para usuario ${createdByUserId || 'anónimo'}`,
    );
    if (!dto.items || dto.items.length === 0)
      throw new BadRequestException('Debe incluir items.');

    // Validar límites
    this.limits.validateItemsCount(dto.items.length, 'sale');
    for (const item of dto.items) {
      this.limits.validateItemQty(item.qty);
    }

    // Validar que la sesión de caja existe y está abierta
    if (!dto.cashSessionId) {
      throw new BadRequestException(
        'cashSessionId requerido para registrar caja.',
      );
    }

    const cashSession = await this.prisma.cashSession.findUnique({
      where: { id: dto.cashSessionId },
    });

    if (!cashSession) {
      throw new NotFoundException(
        `Sesión de caja con id ${dto.cashSessionId} no encontrada.`,
      );
    }

    if (cashSession.closedAt) {
      throw new BadRequestException(
        `No se puede crear venta. La sesión de caja ${dto.cashSessionId} está cerrada.`,
      );
    }

    // Validar que el cliente existe si se proporciona
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) {
        throw new NotFoundException(
          `Cliente con id ${dto.customerId} no encontrado.`,
        );
      }
    }

    return this.prisma
      .$transaction(
        async (tx) => {
          const products = await tx.product.findMany({
            where: { id: { in: dto.items.map((i) => i.productId) } },
            include: { stock: true },
          });
          if (products.length !== dto.items.length) {
            const foundIds = new Set(products.map((p) => p.id));
            const missingProductIds = dto.items
              .map((i) => i.productId)
              .filter((id) => !foundIds.has(id));
            throw new BadRequestException({
              message: 'Uno o más productos no existen o están inactivos.',
              missingProductIds,
            });
          }

          let subtotal = 0;
          let taxTotal = 0;
          const saleItems = dto.items.map((i) => {
            const p = products.find((pp) => pp.id === i.productId)!;
            const unitPrice = i.unitPrice ?? Number(p.price);
            const lineSubtotal = unitPrice * i.qty;
            const lineTax = (lineSubtotal * Number(p.taxRate ?? 0)) / 100;
            const lineTotal = lineSubtotal + lineTax;
            subtotal += lineSubtotal;
            taxTotal += lineTax;
            return {
              productId: p.id,
              qty: i.qty,
              unitPrice,
              taxRate: Number(p.taxRate ?? 0),
              lineTotal,
            };
          });

          const grandTotal = subtotal + taxTotal;

          // Stock check + update
          for (const it of dto.items) {
            const bal = await tx.stockBalance.upsert({
              where: { productId: it.productId },
              create: { productId: it.productId, qtyOnHand: 0, qtyReserved: 0 },
              update: {},
            });
            if (bal.qtyOnHand < it.qty) {
              const product = products.find((p) => p.id === it.productId);
              const name = product?.name ?? it.productId;
              throw new BadRequestException(
                `Stock insuficiente para "${name}". Disponible: ${bal.qtyOnHand}, requerido: ${it.qty}.`,
              );
            }
            await tx.stockBalance.update({
              where: { productId: it.productId },
              data: { qtyOnHand: bal.qtyOnHand - it.qty },
            });
          }

          const sale = await tx.sale.create({
            data: {
              customerId: dto.customerId ?? null,
              status: SaleStatus.PAID,
              subtotal,
              taxTotal,
              discountTotal: 0,
              grandTotal,
              items: { create: saleItems },
            },
            include: { items: true },
          });

          await tx.cashMovement.create({
            data: {
              sessionId: dto.cashSessionId!, // Ya validado arriba, seguro que existe
              type: 'IN',
              method: dto.paymentMethod ?? PaymentMethod.CASH,
              amount: grandTotal,
              relatedSaleId: sale.id,
            },
          });

          const invoice = await tx.invoice.create({
            data: {
              saleId: sale.id,
              customerId: sale.customerId,
              number: makeInvoiceNumber(),
              issuedAt: new Date(),
              status: InvoiceStatus.ISSUED,
              subtotal,
              taxTotal,
              discountTotal: 0,
              grandTotal,
            },
          });

          const dianDoc = await tx.dianDocument.create({
            data: {
              invoiceId: invoice.id,
              type: DianDocumentType.FE,
              status: DianDocumentStatus.DRAFT,
            },
          });

          // Audit logging mejorado
          await tx.auditLog.create({
            data: {
              actorId: createdByUserId ?? null,
              entity: 'sale',
              entityId: sale.id,
              action: 'create',
              diff: {
                invoiceId: invoice.id,
                dianDocumentId: dianDoc.id,
                customerId: sale.customerId,
                grandTotal: Number(sale.grandTotal),
                itemsCount: sale.items.length,
              },
            },
          });

          this.logger.log(
            `Venta creada exitosamente: ${sale.id}, Total: ${Number(sale.grandTotal)}, Factura: ${invoice.number}`,
          );
          return { sale, invoice, dianDocument: dianDoc };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .then(async (result) => {
        // enqueue DIAN processing after commit
        this.logger.log(
          `Encolando procesamiento DIAN para documento ${result.dianDocument.id}`,
        );
        await this.dianQueue.add(
          'send',
          { dianDocumentId: result.dianDocument.id },
          { attempts: 10, backoff: { type: 'exponential', delay: 5000 } },
        );
        // Invalidar caché de listados
        await this.cache.deletePattern('cache:sales:*');
        return result;
      });
  }

  async listSales(pagination?: { page?: number; limit?: number }) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        orderBy: { soldAt: 'desc' },
        include: { items: { include: { product: true } }, customer: true, invoices: true },
        skip,
        take: limit,
      }),
      this.prisma.sale.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };

    // Cachear listados (sin filtros complejos por ahora)
    const cacheKey = this.cache.buildKey('sales', 'list', page, limit);
    await this.cache.set(cacheKey, result, 180); // 3 minutos

    return result;
  }
}
