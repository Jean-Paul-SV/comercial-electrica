import {
  BadRequestException,
  ForbiddenException,
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
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import type { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
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

  async createSale(
    dto: CreateSaleDto,
    createdByUserId?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
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

    // Validar que la sesión de caja existe y está abierta y pertenece al tenant
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

    // Validar que el cliente existe y pertenece al tenant si se proporciona
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

    return this.prisma
      .$transaction(
        async (tx) => {
          const products = await tx.product.findMany({
            where: { id: { in: dto.items.map((i) => i.productId) }, tenantId },
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
              sessionId: dto.cashSessionId, // Ya validado arriba, seguro que existe
              type: 'IN',
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

          // Registrar salida en inventario (Movimientos) para trazabilidad
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
      )
      .then(async (result) => {
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
            summary: `Venta #${result.invoice.number} por ${Number(result.sale.grandTotal).toLocaleString('es-CO')} (${result.sale.items.length} producto${result.sale.items.length !== 1 ? 's' : ''})`,
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
      });
  }

  async listSales(
    pagination?: { page?: number; limit?: number; search?: string },
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = pagination?.search?.trim();

    const where: Prisma.SaleWhereInput = { tenantId };
    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        {
          invoices: {
            some: { number: { contains: search, mode: 'insensitive' } },
          },
        },
        { createdBy: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const useListCache = !search && page === 1 && limit === 20 && tenantId;
    if (useListCache) {
      const listCacheKey = this.cache.buildKey('sales', 'list', tenantId, 1, 20);
      const cached = await this.cache.get<{ data: unknown[]; meta: unknown }>(listCacheKey);
      if (cached) return cached;
    }

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        orderBy: { soldAt: 'desc' },
        select: {
          id: true,
          customerId: true,
          createdByUserId: true,
          status: true,
          soldAt: true,
          subtotal: true,
          taxTotal: true,
          discountTotal: true,
          grandTotal: true,
          createdAt: true,
          updatedAt: true,
          items: { include: { product: true } },
          customer: true,
          invoices: true,
          createdBy: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
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

    if (useListCache) {
      const listCacheKey = this.cache.buildKey('sales', 'list', tenantId, 1, 20);
      await this.cache.set(listCacheKey, result, 60);
    }
    return result;
  }

  /**
   * Obtiene una venta por ID (solo del tenant).
   */
  async getSale(id: string, tenantId: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        customerId: true,
        createdByUserId: true,
        status: true,
        soldAt: true,
        subtotal: true,
        taxTotal: true,
        discountTotal: true,
        grandTotal: true,
        createdAt: true,
        updatedAt: true,
        items: { include: { product: true } },
        customer: true,
        invoices: true,
        createdBy: { select: { id: true, email: true } },
      },
    });
    if (!sale) {
      throw new NotFoundException(`Venta con id ${id} no encontrada.`);
    }
    return sale;
  }

  /**
   * Lista todas las facturas de venta del tenant (paginado).
   * Incluye cliente y venta asociada.
   */
  async listInvoices(
    tenantId: string | null,
    query?: { page?: number; limit?: number; search?: string; status?: InvoiceStatus },
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query?.search?.trim();
    const status = query?.status;

    const where: Prisma.InvoiceWhereInput = { tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        select: {
          id: true,
          number: true,
          issuedAt: true,
          status: true,
          subtotal: true,
          taxTotal: true,
          discountTotal: true,
          grandTotal: true,
          saleId: true,
          customerId: true,
          customer: { select: { id: true, name: true } },
          sale: { select: { id: true, soldAt: true } },
          dianDocument: {
            select: { status: true, lastError: true },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
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
  }

  /**
   * Anula una factura (estado VOIDED): actualiza factura, venta a CANCELLED,
   * devuelve stock, registra movimiento de caja OUT y movimiento de inventario IN por anulación.
   */
  async voidInvoice(invoiceId: string, tenantId: string | null, userId?: string) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        sale: {
          include: {
            items: true,
          },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException(`Factura ${invoiceId} no encontrada.`);
    }
    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new BadRequestException('La factura ya está anulada.');
    }
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Solo se pueden anular facturas emitidas.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.VOIDED },
      });

      if (invoice.saleId && invoice.sale) {
        await tx.sale.update({
          where: { id: invoice.saleId },
          data: { status: SaleStatus.CANCELLED },
        });

        // Devolver stock
        for (const item of invoice.sale.items) {
          await tx.stockBalance.upsert({
            where: { productId: item.productId },
            create: { productId: item.productId, qtyOnHand: item.qty, qtyReserved: 0 },
            update: { qtyOnHand: { increment: item.qty } },
          });
        }

        // Movimiento de inventario (entrada por anulación)
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            type: InventoryMovementType.IN,
            reason: 'Anulación factura',
            items: {
              create: invoice.sale.items.map((it) => ({
                productId: it.productId,
                qty: it.qty,
              })),
            },
          },
        });

        // Reversar movimiento de caja: buscar el IN de la venta y crear un OUT
        const originalMovement = await tx.cashMovement.findFirst({
          where: { relatedSaleId: invoice.saleId, type: CashMovementType.IN },
        });
        if (originalMovement) {
          await tx.cashMovement.create({
            data: {
              sessionId: originalMovement.sessionId,
              type: CashMovementType.OUT,
              method: originalMovement.method,
              amount: originalMovement.amount,
              reference: `Anulación factura ${invoice.number}`,
            },
          });
        }
      }

      return null;
    });

    await this.audit.log(
      'invoice',
      invoiceId,
      'void',
      userId ?? null,
      { number: invoice.number, saleId: invoice.saleId },
    );
    this.logger.log(`Factura ${invoice.number} anulada.`);
    await this.cache.deletePattern('cache:sales:*');
    return { success: true, message: 'Factura anulada.' };
  }
}
