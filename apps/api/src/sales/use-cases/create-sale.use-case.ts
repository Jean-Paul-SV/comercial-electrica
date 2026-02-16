import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CashMovementType,
  DianDocumentStatus,
  DianDocumentType,
  InvoiceStatus,
  InventoryMovementType,
  PaymentMethod,
  Prisma,
  SaleStatus,
} from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationLimitsService } from '../../common/services/validation-limits.service';
import { AuditService } from '../../common/services/audit.service';
import { CacheService } from '../../common/services/cache.service';
import { DianService } from '../../dian/dian.service';
import { CreateSaleDto } from '../dto/create-sale.dto';

function makeInvoiceNumber(now = new Date()) {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `INV-${yyyy}${mm}${dd}-${rand}`;
}

@Injectable()
export class CreateSaleUseCase {
  private readonly logger = new Logger(CreateSaleUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('dian') private readonly dianQueue: Queue,
    private readonly limits: ValidationLimitsService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly dianService: DianService,
  ) {}

  async execute(
    dto: CreateSaleDto,
    createdByUserId: string | undefined,
    tenantId: string,
  ) {
    const dianStatus = await this.dianService.getConfigStatusForTenant(tenantId);
    if (!dianStatus.readyForSend) {
      const msg =
        dianStatus.status === 'not_configured'
          ? 'Configure la facturación electrónica en Cuenta → Facturación electrónica antes de registrar ventas.'
          : dianStatus.status === 'cert_expired'
            ? 'El certificado de firma electrónica está vencido. Renuévelo en Cuenta → Facturación electrónica.'
            : dianStatus.status === 'range_exhausted'
              ? 'El rango de numeración DIAN está agotado. Solicite un nuevo rango y actualice la configuración.'
              : 'Complete la configuración de facturación electrónica en Cuenta → Facturación electrónica para poder registrar ventas.';
      throw new BadRequestException(msg);
    }

    this.logger.log(
      `Creando venta para usuario ${createdByUserId || 'anónimo'}`,
    );
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debe incluir items.');
    }

    this.limits.validateItemsCount(dto.items.length, 'sale');
    for (const item of dto.items) {
      this.limits.validateItemQty(item.qty);
    }

    if (!dto.cashSessionId) {
      throw new BadRequestException(
        'cashSessionId requerido para registrar caja.',
      );
    }

    const cashSession = await this.prisma.cashSession.findFirst({
      where: { id: dto.cashSessionId, tenantId },
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

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId },
      });
      if (!customer) {
        throw new NotFoundException(
          `Cliente con id ${dto.customerId} no encontrado.`,
        );
      }
    }

    const result = await this.prisma
      .$transaction(
        async (tx) => {
          const products = await tx.product.findMany({
            where: {
              id: { in: dto.items.map((i) => i.productId) },
              tenantId,
            },
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

          const discountTotal = Math.min(
            Number(dto.discountTotal ?? 0),
            subtotal + taxTotal,
          );
          const grandTotal = Math.max(0, subtotal + taxTotal - discountTotal);

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
              tenantId,
              customerId: dto.customerId ?? null,
              createdByUserId: createdByUserId ?? null,
              status: SaleStatus.PAID,
              subtotal,
              taxTotal,
              discountTotal,
              grandTotal,
              items: { create: saleItems },
            },
            include: { items: true },
          });

          await tx.cashMovement.create({
            data: {
              sessionId: dto.cashSessionId,
              type: CashMovementType.IN,
              method: dto.paymentMethod ?? PaymentMethod.CASH,
              amount: grandTotal,
              relatedSaleId: sale.id,
            },
          });

          const invoice = await tx.invoice.create({
            data: {
              tenantId,
              saleId: sale.id,
              customerId: sale.customerId,
              number: makeInvoiceNumber(),
              issuedAt: new Date(),
              status: InvoiceStatus.ISSUED,
              subtotal,
              taxTotal,
              discountTotal,
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

          await tx.inventoryMovement.create({
            data: {
              tenantId,
              type: InventoryMovementType.OUT,
              reason: 'Venta',
              items: {
                create: dto.items.map((it) => ({
                  productId: it.productId,
                  qty: it.qty,
                })),
              },
            },
          });

          this.logger.log(
            `Venta creada exitosamente: ${sale.id}, Total: ${Number(sale.grandTotal)}, Factura: ${invoice.number}`,
          );
          return { sale, invoice, dianDocument: dianDoc };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    await this.audit.logCreate(
      'sale',
      result.sale.id,
      createdByUserId,
      {
        invoiceId: result.invoice.id,
        dianDocumentId: result.dianDocument.id,
        customerId: result.sale.customerId,
        grandTotal: Number(result.sale.grandTotal),
        itemsCount: result.sale.items.length,
      },
      {
        summary: `Venta #${result.invoice.number} por ${Number(
          result.sale.grandTotal,
        ).toLocaleString('es-CO')} (${
          result.sale.items.length
        } producto${result.sale.items.length !== 1 ? 's' : ''})`,
      },
    );
    this.logger.log(
      `Encolando procesamiento DIAN para documento ${result.dianDocument.id}`,
    );
    await this.dianQueue.add(
      'send',
      { dianDocumentId: result.dianDocument.id },
      {
        jobId: `dian-${result.dianDocument.id}`,
        attempts: 10,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    await this.cache.deletePattern('cache:sales:*');
    return result;
  }
}

