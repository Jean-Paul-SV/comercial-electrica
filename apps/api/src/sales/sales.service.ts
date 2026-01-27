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
  ) {}

  async createSale(dto: CreateSaleDto, createdByUserId?: string) {
    this.logger.log(
      `Creando venta para usuario ${createdByUserId || 'anónimo'}`,
    );
    if (!dto.items || dto.items.length === 0)
      throw new BadRequestException('Debe incluir items.');

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
            throw new BadRequestException('Uno o más productos no existen.');
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
              throw new BadRequestException(
                `Stock insuficiente para productId=${it.productId}. Disponible=${bal.qtyOnHand}, requerido=${it.qty}.`,
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

          // Audit minimal (placeholder)
          await tx.auditLog.create({
            data: {
              actorId: createdByUserId ?? null,
              entity: 'sale',
              entityId: sale.id,
              action: 'create',
              diff: { invoiceId: invoice.id, dianDocumentId: dianDoc.id },
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
        return result;
      });
  }

  listSales() {
    return this.prisma.sale.findMany({
      orderBy: { soldAt: 'desc' },
      include: { items: true, customer: true, invoices: true },
      take: 200,
    });
  }
}
