import {
  BadRequestException,
  ForbiddenException,
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

  async createQuote(dto: CreateQuoteDto, createdByUserId?: string, tenantId?: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
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

    return this.prisma.$transaction(
      async (tx) => {
        // Validar que los productos existan y pertenezcan al tenant
        const products = await tx.product.findMany({
          where: { id: { in: dto.items.map((i) => i.productId) }, tenantId },
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

        const discountPercent = Math.min(
          100,
          Math.max(0, Number(dto.discountPercent ?? 0)),
        );
        const discountTotal = Math.round(
          ((subtotal + taxTotal) * discountPercent) / 100,
        );
        const grandTotal = Math.max(0, subtotal + taxTotal - discountTotal);

        // Calcular fecha de validez (por defecto 30 días desde hoy)
        const validUntil = dto.validUntil
          ? new Date(dto.validUntil)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Crear cotización
        const quote = await tx.quote.create({
          data: {
            tenantId,
            customerId: dto.customerId ?? null,
            status: QuoteStatus.DRAFT,
            validUntil,
            subtotal,
            taxTotal,
            discountTotal,
            grandTotal,
            items: { create: quoteItems },
          },
          include: {
            items: { include: { product: true } },
            customer: true,
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
      search?: string;
    },
    pagination?: { page?: number; limit?: number },
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    // Cachear listados frecuentes (sin filtros o con filtros comunes)
    if (!filters || (!filters.status && !filters.customerId && !filters.search)) {
      const cacheKey = this.cache.buildKey('quotes', 'list', tenantId, pagination?.page, pagination?.limit);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Quotes list retrieved from cache');
        return cached;
      }
    }
    const where: Prisma.QuoteWhereInput = { tenantId };
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }
    if (filters?.search) {
      where.customer = {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { docNumber: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
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
    if (!filters || (!filters.status && !filters.customerId && !filters.search)) {
      const cacheKey = this.cache.buildKey('quotes', 'list', tenantId, page, limit);
      await this.cache.set(cacheKey, result, 300); // 5 minutos
    }

    return result;
  }

  async getQuoteById(id: string, tenantId?: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const quote = await this.prisma.quote.findFirst({
      where: { id, tenantId },
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

  async updateQuote(id: string, dto: UpdateQuoteDto, updatedByUserId?: string, tenantId?: string | null) {
    const quote = await this.getQuoteById(id, tenantId);

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
    tenantId?: string | null,
  ) {
    const quote = await this.getQuoteById(id, tenantId);

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
              tenantId: quote.tenantId,
              customerId: quote.customerId ?? null,
              createdByUserId: convertedByUserId ?? null,
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
              tenantId: quote.tenantId,
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
    tenantId?: string | null,
  ) {
    const quote = await this.getQuoteById(id, tenantId);

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
      return updatedQuote;
    }).then(async (updated) => {
      await this.audit.log('quote', id, 'update_status', updatedByUserId, {
        oldStatus: quote.status,
        newStatus: status,
      });
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
      await this.audit.log('quote', 'cron', 'expire_batch', null, {
        count: result.count,
        reason: 'validUntil < now',
      });
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
