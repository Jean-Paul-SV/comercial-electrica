import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CashMovementType,
  InvoiceStatus,
  InventoryMovementType,
  Prisma,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import type { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { AuditService } from '../common/services/audit.service';
import { CacheService } from '../common/services/cache.service';
import { TenantContextService } from '../common/services/tenant-context.service';
import { buildPaginationMeta } from '../common/utils/pagination';
import { CreateSaleUseCase } from './use-cases/create-sale.use-case';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly createSaleUseCase: CreateSaleUseCase,
    private readonly tenantContext: TenantContextService,
  ) {}

  async createSale(
    dto: CreateSaleDto,
    createdByUserId?: string,
    tenantId?: string | null,
  ) {
    const currentTenantId = this.tenantContext.ensureTenant(tenantId);
    return this.createSaleUseCase.execute(
      dto,
      createdByUserId,
      currentTenantId,
    );
  }

  async listSales(
    pagination?: { page?: number; limit?: number; search?: string },
    tenantId?: string | null,
  ) {
    const currentTenantId = this.tenantContext.ensureTenant(tenantId);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = pagination?.search?.trim();

    const where: Prisma.SaleWhereInput = { tenantId: currentTenantId };
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

    const useListCache =
      !search && page === 1 && limit === 20 && currentTenantId;
    if (useListCache) {
      const listCacheKey = this.cache.buildKey(
        'sales',
        'list',
        currentTenantId,
        1,
        20,
      );
      const cached = await this.cache.get<{ data: unknown[]; meta: unknown }>(
        listCacheKey,
      );
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

    const result = {
      data,
      meta: buildPaginationMeta(total, page, limit),
    };

    if (useListCache) {
      const listCacheKey = this.cache.buildKey(
        'sales',
        'list',
        currentTenantId,
        1,
        20,
      );
      await this.cache.set(listCacheKey, result, 60);
    }
    return result;
  }

  /**
   * Obtiene una venta por ID (solo del tenant).
   */
  async getSale(id: string, tenantId: string | null) {
    const currentTenantId = this.tenantContext.ensureTenant(tenantId);
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId: currentTenantId },
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
        invoices: {
          include: {
            dianDocument: { select: { id: true } },
          },
        },
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
    query?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: InvoiceStatus;
    },
  ) {
    const currentTenantId = this.tenantContext.ensureTenant(tenantId);
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query?.search?.trim();
    const status = query?.status;

    const where: Prisma.InvoiceWhereInput = { tenantId: currentTenantId };
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
          sale: {
            select: {
              id: true,
              soldAt: true,
              requireElectronicInvoice: true, // Asegurar que este campo se devuelva explícitamente
            },
          },
          dianDocument: {
            select: { status: true, lastError: true },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    // Log temporal simplificado para depuración - solo log básico para evitar problemas
    if (data.length > 0 && process.env.NODE_ENV === 'development') {
      try {
        const firstInvoiceWithSale = data.find((inv) => inv.sale != null);
        if (firstInvoiceWithSale) {
          console.log(
            '[SalesService.listInvoices] Primera factura con venta:',
            {
              invoiceNumber: firstInvoiceWithSale.number,
              saleRequireElectronicInvoice:
                firstInvoiceWithSale.sale?.requireElectronicInvoice,
            },
          );
        }
      } catch (logError) {
        // Ignorar errores de logging para no afectar la respuesta
      }
    }

    // Normalizar los datos para asegurar que requireElectronicInvoice siempre tenga un valor
    // Si es undefined o null, asumir true (comportamiento por defecto)
    // También asegurar que las fechas se serialicen correctamente
    const normalizedData = data.map((inv) => {
      try {
        // Solo normalizar si sale existe y requireElectronicInvoice necesita normalización
        if (inv.sale && inv.sale != null) {
          const currentValue = inv.sale.requireElectronicInvoice;
          const needsNormalization =
            currentValue === null || currentValue === undefined;

          if (needsNormalization) {
            const requireElectronicInvoice = true; // Valor por defecto

            // Log solo si el valor necesita normalización
            if (process.env.NODE_ENV === 'development') {
              console.log(
                '[SalesService.listInvoices] Normalizando requireElectronicInvoice para factura:',
                inv.number,
              );
            }

            // Construir el objeto de retorno solo con los campos necesarios, asegurando serialización correcta
            const saleSoldAt =
              inv.sale.soldAt instanceof Date
                ? inv.sale.soldAt.toISOString()
                : typeof inv.sale.soldAt === 'string'
                  ? inv.sale.soldAt
                  : String(inv.sale.soldAt);

            return {
              id: inv.id,
              number: inv.number,
              issuedAt:
                inv.issuedAt instanceof Date
                  ? inv.issuedAt.toISOString()
                  : inv.issuedAt,
              status: inv.status,
              subtotal: Number(inv.subtotal),
              taxTotal: Number(inv.taxTotal),
              discountTotal: Number(inv.discountTotal),
              grandTotal: Number(inv.grandTotal),
              saleId: inv.saleId,
              customerId: inv.customerId,
              customer: inv.customer,
              sale: {
                id: inv.sale.id,
                soldAt: saleSoldAt,
                requireElectronicInvoice,
              },
              dianDocument: inv.dianDocument,
            };
          }

          // Si el valor ya está definido, asegurar que soldAt esté serializado correctamente
          if (inv.sale.soldAt instanceof Date) {
            return {
              ...inv,
              sale: {
                ...inv.sale,
                soldAt: inv.sale.soldAt.toISOString(),
              },
            };
          }
        }

        // Asegurar que issuedAt esté serializado correctamente si es Date
        if (inv.issuedAt instanceof Date) {
          return {
            ...inv,
            issuedAt: inv.issuedAt.toISOString(),
          };
        }

        return inv;
      } catch (error) {
        // Si hay un error al procesar, devolver el objeto original

        console.error(
          '[SalesService.listInvoices] Error al procesar factura:',
          inv.number,
          error,
        );
        return inv;
      }
    });

    try {
      return {
        data: normalizedData,
        meta: buildPaginationMeta(total, page, limit),
      };
    } catch (error) {
      // Si hay un error al construir la respuesta, loggear y devolver datos sin normalizar

      console.error(
        '[SalesService.listInvoices] Error al construir respuesta:',
        error,
      );
      return {
        data,
        meta: buildPaginationMeta(total, page, limit),
      };
    }
  }

  /**
   * Anula una factura (estado VOIDED): actualiza factura, venta a CANCELLED,
   * devuelve stock, registra movimiento de caja OUT y movimiento de inventario IN por anulación.
   */
  async voidInvoice(
    invoiceId: string,
    tenantId: string | null,
    userId?: string,
  ) {
    const currentTenantId = this.tenantContext.ensureTenant(tenantId);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: currentTenantId },
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
            create: {
              productId: item.productId,
              qtyOnHand: item.qty,
              qtyReserved: 0,
            },
            update: { qtyOnHand: { increment: item.qty } },
          });
        }

        // Movimiento de inventario (entrada por anulación)
        await tx.inventoryMovement.create({
          data: {
            tenantId: currentTenantId,
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

    await this.audit.log('invoice', invoiceId, 'void', userId ?? null, {
      number: invoice.number,
      saleId: invoice.saleId,
    });
    this.logger.log(`Factura ${invoice.number} anulada.`);
    await this.cache.deletePattern('cache:sales:*');
    return { success: true, message: 'Factura anulada.' };
  }
}
