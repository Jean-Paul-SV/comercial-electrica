import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QuoteStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { ConvertQuoteDto } from './dto/convert-quote.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DianDocumentStatus,
  DianDocumentType,
  SaleStatus,
} from '@prisma/client';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';
import { CacheService } from '../common/services/cache.service';
import { createPaginatedResponse } from '../common/interfaces/pagination.interface';

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('dian') private readonly dianQueue: Queue,
    private readonly limits: ValidationLimitsService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  async createQuote(dto: CreateQuoteDto, createdByUserId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debe incluir items.');
    }

    // Validar límites
    this.limits.validateItemsCount(dto.items.length, 'quote');
    for (const item of dto.items) {
      this.limits.validateItemQty(item.qty);
    }

    // Validar fecha de validez si se proporciona
    if (dto.validUntil) {
      const validUntilDate = new Date(dto.validUntil);
      this.limits.validateQuoteValidUntil(validUntilDate);
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

    return this.prisma.$transaction(
      async (tx) => {
        // Validar que los productos existan
        const products = await tx.product.findMany({
          where: { id: { in: dto.items.map((i) => i.productId) } },
        });

        if (products.length !== dto.items.length) {
          throw new BadRequestException('Uno o más productos no existen.');
        }

        // Calcular totales
        let subtotal = 0;
        let taxTotal = 0;
        const quoteItems = dto.items.map((i) => {
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

        // Calcular fecha de validez (por defecto 30 días desde hoy)
        const validUntil = dto.validUntil
          ? new Date(dto.validUntil)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Crear cotización
        const quote = await tx.quote.create({
          data: {
            customerId: dto.customerId ?? null,
            status: QuoteStatus.DRAFT,
            validUntil,
            subtotal,
            taxTotal,
            discountTotal: 0,
            grandTotal,
            items: { create: quoteItems },
          },
          include: {
            items: { include: { product: true } },
            customer: true,
          },
        });

        // Audit log mejorado
        await tx.auditLog.create({
          data: {
            actorId: createdByUserId ?? null,
            entity: 'quote',
            entityId: quote.id,
            action: 'create',
            diff: {
              customerId: quote.customerId,
              grandTotal: Number(quote.grandTotal),
              itemsCount: quote.items.length,
              validUntil: quote.validUntil?.toISOString(),
            },
          },
        });

        return quote;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).then(async (quote) => {
      // Invalidar caché de listados
      await this.cache.deletePattern('cache:quotes:*');
      return quote;
    });
  }

  async listQuotes(
    filters?: {
      status?: QuoteStatus;
      customerId?: string;
    },
    pagination?: { page?: number; limit?: number },
  ) {
    // Cachear listados frecuentes (sin filtros o con filtros comunes)
    if (!filters || (!filters.status && !filters.customerId)) {
      const cacheKey = this.cache.buildKey('quotes', 'list', pagination?.page, pagination?.limit);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Quotes list retrieved from cache');
        return cached;
      }
    }
    const where: Prisma.QuoteWhereInput = {};
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: true } },
          customer: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.quote.count({ where }),
    ]);

    const result = createPaginatedResponse(data, total, page, limit);

    // Cachear si no hay filtros
    if (!filters || (!filters.status && !filters.customerId)) {
      const cacheKey = this.cache.buildKey('quotes', 'list', page, limit);
      await this.cache.set(cacheKey, result, 300); // 5 minutos
    }

    return result;
  }

  async getQuoteById(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Cotización con ID ${id} no encontrada.`);
    }

    return quote;
  }

  async updateQuote(id: string, dto: UpdateQuoteDto, updatedByUserId?: string) {
    const quote = await this.getQuoteById(id);

    // No permitir actualizar cotizaciones convertidas o canceladas
    if (
      quote.status === QuoteStatus.CONVERTED ||
      quote.status === QuoteStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `No se puede actualizar una cotización con estado ${quote.status}.`,
      );
    }

    // Validar que el cliente existe si se proporciona
    if (dto.customerId !== undefined && dto.customerId !== null) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) {
        throw new NotFoundException(
          `Cliente con id ${dto.customerId} no encontrado.`,
        );
      }
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Si se actualizan los items, recalcular totales
        let updateData: Prisma.QuoteUpdateInput = {};

        if (dto.items && dto.items.length > 0) {
          // Validar productos
          const products = await tx.product.findMany({
            where: { id: { in: dto.items.map((i) => i.productId) } },
          });

          if (products.length !== dto.items.length) {
            throw new BadRequestException('Uno o más productos no existen.');
          }

          // Recalcular totales
          let subtotal = 0;
          let taxTotal = 0;
          const quoteItems = dto.items.map((i) => {
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

          // Eliminar items antiguos y crear nuevos
          await tx.quoteItem.deleteMany({ where: { quoteId: id } });

          updateData = {
            subtotal,
            taxTotal,
            grandTotal,
            items: { create: quoteItems },
          };
        }

        if (dto.status) {
          updateData.status = dto.status;
        }

        if (dto.validUntil) {
          updateData.validUntil = new Date(dto.validUntil);
        }

        if (dto.customerId !== undefined) {
          if (dto.customerId) {
            updateData.customer = { connect: { id: dto.customerId } };
          } else {
            updateData.customer = { disconnect: true };
          }
        }

        const updatedQuote = await tx.quote.update({
          where: { id },
          data: updateData,
          include: {
            items: { include: { product: true } },
            customer: true,
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            actorId: updatedByUserId ?? null,
            entity: 'quote',
            entityId: id,
            action: 'update',
          },
        });

        return updatedQuote;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).then(async (updated) => {
      // Invalidar caché de listados
      await this.cache.deletePattern('cache:quotes:*');
      return updated;
    });
  }

  async convertQuoteToSale(
    id: string,
    dto: ConvertQuoteDto,
    convertedByUserId?: string,
  ) {
    const quote = await this.getQuoteById(id);

    // Validar que la cotización pueda ser convertida
    if (quote.status === QuoteStatus.CONVERTED) {
      throw new BadRequestException(
        'Esta cotización ya fue convertida a venta.',
      );
    }

    if (quote.status === QuoteStatus.CANCELLED) {
      throw new BadRequestException(
        'No se puede convertir una cotización cancelada.',
      );
    }

    if (quote.status === QuoteStatus.EXPIRED) {
      throw new BadRequestException(
        'No se puede convertir una cotización expirada.',
      );
    }

    if (quote.validUntil && quote.validUntil < new Date()) {
      throw new BadRequestException(
        'No se puede convertir una cotización vencida.',
      );
    }

    // Validar que la sesión de caja existe y está abierta
    if (!dto.cashSessionId) {
      throw new BadRequestException(
        'cashSessionId requerido para convertir cotización a venta.',
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
        `No se puede convertir cotización. La sesión de caja ${dto.cashSessionId} está cerrada.`,
      );
    }

    return this.prisma
      .$transaction(
        async (tx) => {
          // Crear la venta desde la cotización
          const sale = await tx.sale.create({
            data: {
              customerId: quote.customerId ?? null,
              status: SaleStatus.PAID,
              subtotal: Number(quote.subtotal),
              taxTotal: Number(quote.taxTotal),
              discountTotal: Number(quote.discountTotal),
              grandTotal: Number(quote.grandTotal),
              items: {
                create: quote.items.map((item) => ({
                  productId: item.productId,
                  qty: item.qty,
                  unitPrice: item.unitPrice,
                  taxRate: item.taxRate,
                  lineTotal: item.lineTotal,
                })),
              },
            },
          });

          // Validar y actualizar stock
          for (const item of quote.items) {
            const bal = await tx.stockBalance.upsert({
              where: { productId: item.productId },
              create: {
                productId: item.productId,
                qtyOnHand: 0,
                qtyReserved: 0,
              },
              update: {},
            });

            if (bal.qtyOnHand < item.qty) {
              throw new BadRequestException(
                `Stock insuficiente para producto ${item.productId}. Disponible=${bal.qtyOnHand}, requerido=${item.qty}.`,
              );
            }

            await tx.stockBalance.update({
              where: { productId: item.productId },
              data: { qtyOnHand: bal.qtyOnHand - item.qty },
            });
          }

          // Crear movimiento de caja
          await tx.cashMovement.create({
            data: {
              sessionId: dto.cashSessionId,
              type: 'IN',
              method: dto.paymentMethod,
              amount: quote.grandTotal,
              relatedSaleId: sale.id,
            },
          });

          // Crear factura
          const invoice = await tx.invoice.create({
            data: {
              saleId: sale.id,
              customerId: sale.customerId,
              number: this.makeInvoiceNumber(),
              issuedAt: new Date(),
              status: 'ISSUED',
              subtotal: Number(quote.subtotal),
              taxTotal: Number(quote.taxTotal),
              discountTotal: Number(quote.discountTotal),
              grandTotal: Number(quote.grandTotal),
            },
          });

          // Crear documento DIAN
          const dianDoc = await tx.dianDocument.create({
            data: {
              invoiceId: invoice.id,
              type: DianDocumentType.FE,
              status: DianDocumentStatus.DRAFT,
            },
          });

          // Actualizar cotización a CONVERTED
          await tx.quote.update({
            where: { id },
            data: { status: QuoteStatus.CONVERTED },
          });

          // Audit logs
          await tx.auditLog.create({
            data: {
              actorId: convertedByUserId ?? null,
              entity: 'quote',
              entityId: id,
              action: 'convert',
              diff: { saleId: sale.id, invoiceId: invoice.id },
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: convertedByUserId ?? null,
              entity: 'sale',
              entityId: sale.id,
              action: 'create',
              diff: { fromQuote: id },
            },
          });

          return {
            quote: await tx.quote.findUnique({
              where: { id },
              include: {
                items: { include: { product: true } },
                customer: true,
              },
            }),
            sale: await tx.sale.findUnique({
              where: { id: sale.id },
              include: {
                items: { include: { product: true } },
                customer: true,
              },
            }),
            invoice,
            dianDocument: dianDoc,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .then(async (result) => {
        // Encolar procesamiento DIAN después del commit
        await this.dianQueue.add(
          'send',
          { dianDocumentId: result.dianDocument.id },
          { attempts: 10, backoff: { type: 'exponential', delay: 5000 } },
        );
        return result;
      });
  }

  async updateQuoteStatus(
    id: string,
    status: QuoteStatus,
    updatedByUserId?: string,
  ) {
    const quote = await this.getQuoteById(id);

    // Validaciones de cambio de estado
    if (quote.status === QuoteStatus.CONVERTED) {
      throw new BadRequestException(
        'No se puede cambiar el estado de una cotización convertida.',
      );
    }

    if (
      quote.status === QuoteStatus.CANCELLED &&
      status !== QuoteStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'No se puede reactivar una cotización cancelada.',
      );
    }

    // Validar transiciones de estado válidas
    const validTransitions: Record<QuoteStatus, QuoteStatus[]> = {
      [QuoteStatus.DRAFT]: [
        QuoteStatus.SENT,
        QuoteStatus.CANCELLED,
        QuoteStatus.EXPIRED,
      ],
      [QuoteStatus.SENT]: [
        QuoteStatus.DRAFT,
        QuoteStatus.CANCELLED,
        QuoteStatus.EXPIRED,
      ],
      [QuoteStatus.EXPIRED]: [QuoteStatus.CANCELLED], // Solo se puede cancelar una expirada
      [QuoteStatus.CONVERTED]: [], // No se puede cambiar desde convertida
      [QuoteStatus.CANCELLED]: [], // No se puede cambiar desde cancelada
    };

    const allowedStatuses = validTransitions[quote.status];
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(
        `No se puede cambiar el estado de ${quote.status} a ${status}. Transiciones permitidas: ${allowedStatuses.join(', ')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedQuote = await tx.quote.update({
        where: { id },
        data: { status },
        include: {
          items: { include: { product: true } },
          customer: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: updatedByUserId ?? null,
          entity: 'quote',
          entityId: id,
          action: 'update_status',
          diff: { oldStatus: quote.status, newStatus: status },
        },
      });

      return updatedQuote;
    }).then(async (updated) => {
      // Invalidar caché de listados
      await this.cache.deletePattern('cache:quotes:*');
      return updated;
    });
  }

  /**
   * Job programado que se ejecuta diariamente a medianoche
   * para expirar automáticamente las cotizaciones vencidas
   */
  @Cron('0 0 * * *') // Ejecutar todos los días a las 00:00
  async expireQuotes() {
    this.logger.log('Ejecutando job de expiración de cotizaciones...');
    const now = new Date();
    const result = await this.prisma.quote.updateMany({
      where: {
        status: { in: [QuoteStatus.DRAFT, QuoteStatus.SENT] },
        validUntil: { lt: now },
      },
      data: { status: QuoteStatus.EXPIRED },
    });

    if (result.count > 0) {
      this.logger.log(`Se expiraron ${result.count} cotizaciones`);
    }

    return { expired: result.count };
  }

  private makeInvoiceNumber(now = new Date()) {
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `INV-${yyyy}${mm}${dd}-${rand}`;
  }
}
