import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SalesReportDto } from './dto/sales-report.dto';
import { InventoryReportDto } from './dto/inventory-report.dto';
import { CashReportDto } from './dto/cash-report.dto';
import { CustomersReportDto } from './dto/customers-report.dto';
import { ExportReportDto, ExportEntity } from './dto/export-report.dto';
import {
  OperationalStateResponse,
  OperationalAlert,
} from './interfaces/operational-state.interface';
import {
  ActionableIndicatorsResponse,
  ActionableIndicator,
  ActionableIndicatorItem,
} from './interfaces/actionable-indicators.interface';
import { ActionableIndicatorsDto } from './dto/actionable-indicators.dto';
import { CustomerClustersDto } from './dto/customer-clusters.dto';
import { TrendingProductsDto } from './dto/trending-products.dto';
import { Prisma } from '@prisma/client';
import { CacheService } from '../common/services/cache.service';
import { kmeans } from 'ml-kmeans';

const LOW_STOCK_THRESHOLD = 10;
const QUOTES_EXPIRING_DAYS = 7;
const INVOICES_DUE_SOON_DAYS = 7;
const LOOKBACK_DAYS = 7;

function csvEscape(
  value: string | number | { toString(): string } | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? value.toString() : String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const SCHEMA_ERROR_MESSAGE =
  'La base de datos no está actualizada. Ejecute en la raíz del proyecto: npm run prisma:migrate';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  private async wrapReport<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e) {
        const code = (e as { code?: string }).code;
        if (code === 'P2021' || code === 'P2022') {
          this.logger.warn(
            `Report failed (Prisma ${code}): ${SCHEMA_ERROR_MESSAGE}`,
          );
          throw new BadRequestException(SCHEMA_ERROR_MESSAGE);
        }
      }
      throw e;
    }
  }

  async getSalesReport(dto: SalesReportDto, tenantId: string) {
    // Validar rango de fechas (máximo 1 año)
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      const diffDays = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays > 365) {
        throw new BadRequestException(
          'El rango de fechas no puede ser mayor a 1 año',
        );
      }
      if (start > end) {
        throw new BadRequestException(
          'La fecha de inicio no puede ser mayor a la fecha de fin',
        );
      }
    }

    const where: Prisma.SaleWhereInput = {
      tenantId,
      status: 'PAID', // Solo ventas pagadas
    };

    if (dto.startDate || dto.endDate) {
      where.soldAt = {};
      if (dto.startDate) {
        where.soldAt.gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        where.soldAt.lte = new Date(dto.endDate);
      }
    }

    if (dto.customerId) {
      where.customerId = dto.customerId;
    }

    // Validar límite máximo
    const limit = Math.min(dto.limit ?? 200, 1000);
    if (limit < 1) {
      throw new BadRequestException('El límite debe ser mayor a 0');
    }

    const startTime = Date.now();
    const sales = await this.prisma.sale.findMany({
      where,
      select: {
        id: true,
        customerId: true,
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
      },
      orderBy: { soldAt: 'desc' },
      take: limit,
    });
    const queryTime = Date.now() - startTime;
    this.logger.debug(`Sales report query took ${queryTime}ms`);

    // Calcular totales
    const totals = sales.reduce(
      (acc, sale) => ({
        totalSales: acc.totalSales + 1,
        totalAmount: acc.totalAmount + Number(sale.grandTotal),
        totalSubtotal: acc.totalSubtotal + Number(sale.subtotal),
        totalTax: acc.totalTax + Number(sale.taxTotal),
      }),
      {
        totalSales: 0,
        totalAmount: 0,
        totalSubtotal: 0,
        totalTax: 0,
      },
    );

    return {
      period: {
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
      summary: {
        ...totals,
        averageSale:
          totals.totalSales > 0 ? totals.totalAmount / totals.totalSales : 0,
      },
      sales,
    };
  }

  async getInventoryReport(dto: InventoryReportDto, tenantId: string) {
    const where: Prisma.ProductWhereInput = {
      tenantId,
      isActive: true,
    };

    if (dto.categoryId) {
      where.categoryId = dto.categoryId;
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        stock: true,
        category: true,
        saleItems: {
          take: 1, // Solo para verificar si tiene ventas
          orderBy: { id: 'desc' },
        },
      },
    });

    // Filtrar por stock bajo si se solicita
    let filteredProducts = products;
    if (dto.lowStock) {
      const threshold = dto.lowStockThreshold ?? 10;
      filteredProducts = products.filter(
        (p) => !p.stock || p.stock.qtyOnHand <= threshold,
      );
    }

    // Calcular estadísticas
    const stats = {
      totalProducts: products.length,
      productsWithStock: products.filter(
        (p) => p.stock && p.stock.qtyOnHand > 0,
      ).length,
      productsLowStock: products.filter(
        (p) => !p.stock || p.stock.qtyOnHand <= (dto.lowStockThreshold ?? 10),
      ).length,
      totalStockValue: products.reduce((acc, p) => {
        const stock = p.stock?.qtyOnHand ?? 0;
        return acc + stock * Number(p.cost);
      }, 0),
    };

    return {
      filters: {
        lowStock: dto.lowStock,
        lowStockThreshold: dto.lowStockThreshold ?? 10,
        categoryId: dto.categoryId,
      },
      statistics: stats,
      products: filteredProducts.map((p) => ({
        id: p.id,
        internalCode: p.internalCode,
        name: p.name,
        category: p.category?.name,
        cost: Number(p.cost),
        price: Number(p.price),
        stock: p.stock
          ? {
              qtyOnHand: p.stock.qtyOnHand,
              qtyReserved: p.stock.qtyReserved,
              available: p.stock.qtyOnHand - p.stock.qtyReserved,
            }
          : null,
        stockValue: p.stock ? p.stock.qtyOnHand * Number(p.cost) : 0,
        hasSales: p.saleItems.length > 0,
      })),
    };
  }

  async getCashReport(dto: CashReportDto, tenantId: string) {
    // Validar rango de fechas (máximo 1 año)
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      const diffDays = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays > 365) {
        throw new BadRequestException(
          'El rango de fechas no puede ser mayor a 1 año',
        );
      }
      if (start > end) {
        throw new BadRequestException(
          'La fecha de inicio no puede ser mayor a la fecha de fin',
        );
      }
    }

    const where: Prisma.CashSessionWhereInput = { tenantId };

    if (dto.sessionId) {
      where.id = dto.sessionId;
    }

    if (dto.startDate || dto.endDate) {
      where.openedAt = {};
      if (dto.startDate) {
        where.openedAt.gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        where.openedAt.lte = new Date(dto.endDate);
      }
    }

    const sessions = await this.prisma.cashSession.findMany({
      where,
      include: {
        movements: {
          include: {
            relatedSale: {
              include: {
                customer: true,
              },
            },
          },
        },
      },
      orderBy: { openedAt: 'desc' },
    });

    const METHOD_KEYS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'] as const;

    // Calcular estadísticas por sesión
    const sessionsWithStats = sessions.map((session) => {
      const movements = session.movements;
      const totalIn = movements
        .filter((m) => m.type === 'IN')
        .reduce((acc, m) => acc + Number(m.amount), 0);
      const totalOut = movements
        .filter((m) => m.type === 'OUT')
        .reduce((acc, m) => acc + Number(m.amount), 0);
      const totalAdjust = movements
        .filter((m) => (m.type as string) === 'ADJUST')
        .reduce((acc, m) => acc + Number(m.amount), 0);
      const netAmount = totalIn - totalOut + totalAdjust;
      const expectedAmount = session.closedAt
        ? Number(session.closingAmount)
        : Number(session.openingAmount) + netAmount;
      const difference = session.closedAt
        ? Number(session.closingAmount) - expectedAmount
        : 0;

      const totalsByMethod: Record<string, number> = {};
      for (const key of METHOD_KEYS) totalsByMethod[key] = 0;
      for (const m of movements) {
        const method = String(m.method);
        if (totalsByMethod[method] !== undefined) {
          totalsByMethod[method] += Number(m.amount);
        }
      }

      return {
        id: session.id,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        openingAmount: Number(session.openingAmount),
        closingAmount: session.closedAt ? Number(session.closingAmount) : null,
        movements: {
          total: movements.length,
          totalIn,
          totalOut,
          totalAdjust,
          netAmount,
          totalsByMethod,
        },
        expectedAmount,
        difference,
        isOpen: !session.closedAt,
      };
    });

    // Calcular totales generales
    const totals = sessionsWithStats.reduce(
      (acc, s) => ({
        totalSessions: acc.totalSessions + 1,
        openSessions: acc.openSessions + (s.isOpen ? 1 : 0),
        totalIn: acc.totalIn + s.movements.totalIn,
        totalOut: acc.totalOut + s.movements.totalOut,
        totalAdjust: acc.totalAdjust + (s.movements.totalAdjust ?? 0),
        totalDifference: acc.totalDifference + s.difference,
      }),
      {
        totalSessions: 0,
        openSessions: 0,
        totalIn: 0,
        totalOut: 0,
        totalAdjust: 0,
        totalDifference: 0,
      },
    );

    return {
      period: {
        startDate: dto.startDate,
        endDate: dto.endDate,
        sessionId: dto.sessionId,
      },
      summary: {
        ...totals,
        netAmount: totals.totalIn - totals.totalOut + totals.totalAdjust,
      },
      sessions: sessionsWithStats,
    };
  }

  async getCustomersReport(dto: CustomersReportDto, tenantId: string) {
    // Validar rango de fechas (máximo 1 año)
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      const diffDays = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays > 365) {
        throw new BadRequestException(
          'El rango de fechas no puede ser mayor a 1 año',
        );
      }
      if (start > end) {
        throw new BadRequestException(
          'La fecha de inicio no puede ser mayor a la fecha de fin',
        );
      }
    }

    const where: Prisma.SaleWhereInput = {
      tenantId,
      status: 'PAID',
    };

    if (dto.startDate || dto.endDate) {
      where.soldAt = {};
      if (dto.startDate) {
        where.soldAt.gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        where.soldAt.lte = new Date(dto.endDate);
      }
    }

    // Obtener ventas agrupadas por cliente (select para no depender de createdByUserId)
    const sales = await this.prisma.sale.findMany({
      where: {
        ...where,
        customerId: { not: null },
      },
      select: {
        customerId: true,
        grandTotal: true,
        soldAt: true,
        customer: true,
        items: true,
      },
    });

    // Agrupar por cliente y calcular estadísticas
    type CustomerStat = {
      customer: {
        id: string;
        name: string;
        docType: string | null;
        docNumber: string;
        email: string | null;
      };
      totalSales: number;
      totalAmount: number;
      averageSale: number;
      lastSaleDate: Date | null;
    };

    const customerStats = new Map<string, CustomerStat>();

    sales.forEach((sale) => {
      if (!sale.customerId || !sale.customer) return;

      const existing = customerStats.get(sale.customerId);
      if (existing) {
        existing.totalSales += 1;
        existing.totalAmount += Number(sale.grandTotal);
        existing.averageSale = existing.totalAmount / existing.totalSales;
        if (!existing.lastSaleDate || sale.soldAt > existing.lastSaleDate) {
          existing.lastSaleDate = sale.soldAt;
        }
      } else {
        customerStats.set(sale.customerId, {
          customer: sale.customer,
          totalSales: 1,
          totalAmount: Number(sale.grandTotal),
          averageSale: Number(sale.grandTotal),
          lastSaleDate: sale.soldAt,
        });
      }
    });

    // Convertir a array y ordenar por totalAmount
    let topCustomers = Array.from(customerStats.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount,
    );

    // Limitar si se especifica top
    if (dto.top) {
      topCustomers = topCustomers.slice(0, dto.top);
    }

    return {
      period: {
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
      totalCustomers: customerStats.size,
      topCustomers: topCustomers.map((stat) => ({
        customer: {
          id: stat.customer.id,
          name: stat.customer.name,
          docType: stat.customer.docType,
          docNumber: stat.customer.docNumber,
          email: stat.customer.email,
        },
        statistics: {
          totalSales: stat.totalSales,
          totalAmount: stat.totalAmount,
          averageSale: stat.averageSale,
          lastSaleDate: stat.lastSaleDate,
        },
      })),
    };
  }

  /**
   * Artículos en tendencias: productos ordenados por ingreso total o por unidades vendidas
   * en el período indicado (últimos N días o mes actual).
   */
  async getTrendingProducts(dto: TrendingProductsDto, tenantId: string) {
    const top = Math.min(Math.max(dto.top ?? 20, 1), 100);
    const sortBy = dto.sortBy ?? 'revenue';
    const period = dto.period ?? 'last_days';

    let since: Date;
    let end: Date;
    let periodDays: number;
    if (dto.startDate && dto.endDate) {
      since = new Date(dto.startDate);
      end = new Date(dto.endDate);
      end.setHours(23, 59, 59, 999);
      periodDays = Math.ceil((end.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else if (period === 'current_month') {
      const now = new Date();
      since = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date();
      periodDays = Math.ceil((end.getTime() - since.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      const days = Math.min(Math.max(dto.days ?? 30, 1), 365);
      since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);
      end = new Date();
      periodDays = days;
    }

    const saleItems = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          tenantId,
          status: 'PAID',
          soldAt: { gte: since, ...(end ? { lte: end } : {}) },
        },
      },
      select: {
        productId: true,
        lineTotal: true,
        qty: true,
        product: {
          select: {
            id: true,
            internalCode: true,
            name: true,
            category: { select: { name: true } },
            price: true,
          },
        },
      },
    });

    type ProductStat = {
      product: {
        id: string;
        internalCode: string;
        name: string;
        category: { name: string } | null;
        price: unknown;
      };
      totalRevenue: number;
      totalQty: number;
      salesCount: number;
    };

    const byProduct = new Map<string, ProductStat>();

    saleItems.forEach((item) => {
      const pid = item.productId;
      const existing = byProduct.get(pid);
      const revenue = Number(item.lineTotal);
      const qty = Number(item.qty);
      if (existing) {
        existing.totalRevenue += revenue;
        existing.totalQty += qty;
        existing.salesCount += 1;
      } else {
        byProduct.set(pid, {
          product: item.product,
          totalRevenue: revenue,
          totalQty: qty,
          salesCount: 1,
        });
      }
    });

    const trending = Array.from(byProduct.values())
      .sort((a, b) =>
        sortBy === 'qty'
          ? b.totalQty - a.totalQty
          : b.totalRevenue - a.totalRevenue
      )
      .slice(0, top);

    return {
      periodDays,
      period: period === 'current_month' ? 'current_month' : 'last_days',
      sortBy,
      items: trending.map((stat) => ({
        product: stat.product,
        totalRevenue: stat.totalRevenue,
        totalQty: stat.totalQty,
        salesCount: stat.salesCount,
      })),
    };
  }

  async getDashboard(tenantId: string) {
    return this.wrapReport(async () => {
      const cacheKey = this.cache.buildKey('dashboard', tenantId);
      let cached: unknown = null;
      try {
        cached = await this.cache.get(cacheKey);
      } catch {
        // Redis no disponible: continuar sin caché
      }
      if (cached) {
        this.logger.debug('Dashboard retrieved from cache');
        return cached;
      }

      const startTime = Date.now();
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      // Ventas del día (select explícito para no depender de columnas opcionales como createdByUserId)
      const todaySales = await this.prisma.sale.findMany({
        where: {
          tenantId,
          status: 'PAID',
          soldAt: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
        select: { id: true, grandTotal: true },
      });

      const todaySalesTotal = todaySales.reduce(
        (acc, s) => acc + Number(s.grandTotal),
        0,
      );

      // Productos con stock bajo
      const lowStockProducts = await this.prisma.product.findMany({
        where: {
          tenantId,
          isActive: true,
          stock: {
            qtyOnHand: { lte: 10 },
          },
        },
        include: {
          stock: true,
          category: true,
        },
        take: 10,
      });

      // Sesiones de caja abiertas
      const openCashSessions = await this.prisma.cashSession.findMany({
        where: {
          tenantId,
          closedAt: null,
        },
        include: {
          movements: true,
        },
      });

      // Cotizaciones pendientes (no convertidas ni canceladas)
      const pendingQuotes = await this.prisma.quote.count({
        where: {
          tenantId,
          status: {
            in: ['DRAFT', 'SENT'],
          },
          validUntil: {
            gte: now,
          },
        },
      });

      // Cotizaciones próximas a vencer (próximos 7 días)
      const weekFromNow = new Date(now);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const expiringQuotes = await this.prisma.quote.count({
        where: {
          tenantId,
          status: {
            in: ['DRAFT', 'SENT'],
          },
          validUntil: {
            gte: now,
            lte: weekFromNow,
          },
        },
      });

      // Total de productos activos
      const totalProducts = await this.prisma.product.count({
        where: { tenantId, isActive: true },
      });

      // Total de clientes
      const totalCustomers = await this.prisma.customer.count({
        where: { tenantId },
      });

      const dashboard = {
        date: now.toISOString(),
        tenantId,
        sales: {
          today: {
            count: todaySales.length,
            total: todaySalesTotal,
          },
        },
        inventory: {
          totalProducts,
          lowStockCount: lowStockProducts.length,
          lowStockProducts: lowStockProducts.map((p) => ({
            id: p.id,
            name: p.name,
            stock: p.stock?.qtyOnHand ?? 0,
            category: p.category?.name,
          })),
        },
        cash: {
          openSessions: openCashSessions.length,
          sessions: openCashSessions.map((s) => ({
            id: s.id,
            openedAt: s.openedAt,
            openingAmount: Number(s.openingAmount),
            movementsCount: s.movements.length,
          })),
        },
        quotes: {
          pending: pendingQuotes,
          expiringSoon: expiringQuotes,
        },
        customers: {
          total: totalCustomers,
        },
      };

      const queryTime = Date.now() - startTime;
      this.logger.debug(`Dashboard query took ${queryTime}ms`);

      try {
        await this.cache.set(cacheKey, dashboard, 60);
      } catch {
        // Redis no disponible: no cachear
      }
      return dashboard;
    });
  }

  /**
   * Estado operativo del negocio: indicadores por área y alertas con acción sugerida.
   * Ver docs/ESTADOS_OPERATIVOS_Y_ALERTAS.md
   */
  async getOperationalState(tenantId: string): Promise<OperationalStateResponse> {
    return this.wrapReport(async () => {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      const weekFromNow = new Date(now);
      weekFromNow.setDate(weekFromNow.getDate() + QUOTES_EXPIRING_DAYS);
      const lookbackStart = new Date(now);
      lookbackStart.setDate(lookbackStart.getDate() - LOOKBACK_DAYS);
      const invoicesDueSoonEnd = new Date(now);
      invoicesDueSoonEnd.setDate(
        invoicesDueSoonEnd.getDate() + INVOICES_DUE_SOON_DAYS,
      );

      const [
        openCashSessions,
        lowStockProducts,
        zeroStockProducts,
        pendingQuotesCount,
        expiringSoonQuotesCount,
        expiredQuotesCount,
        todaySales,
        last7DaysSales,
        overdueInvoices,
        dueSoonInvoices,
      ] = await Promise.all([
        this.prisma.cashSession.findMany({
          where: { tenantId, closedAt: null },
          orderBy: { openedAt: 'asc' },
        }),
        this.prisma.product.findMany({
          where: {
            tenantId,
            isActive: true,
            stock: { qtyOnHand: { lte: LOW_STOCK_THRESHOLD } },
          },
          include: { stock: true },
        }),
        this.prisma.product.findMany({
          where: {
            tenantId,
            isActive: true,
            OR: [{ stock: null }, { stock: { qtyOnHand: 0 } }],
          },
          select: { id: true },
        }),
        this.prisma.quote.count({
          where: {
            tenantId,
            status: { in: ['DRAFT', 'SENT'] },
            validUntil: { gte: now },
          },
        }),
        this.prisma.quote.count({
          where: {
            tenantId,
            status: { in: ['DRAFT', 'SENT'] },
            validUntil: { gte: now, lte: weekFromNow },
          },
        }),
        this.prisma.quote.count({
          where: {
            tenantId,
            status: { in: ['DRAFT', 'SENT'] },
            validUntil: { lt: now },
          },
        }),
        this.prisma.sale.findMany({
          where: {
            tenantId,
            status: 'PAID',
            soldAt: { gte: todayStart, lt: todayEnd },
          },
          select: { grandTotal: true },
        }),
        this.prisma.sale.findMany({
          where: {
            tenantId,
            status: 'PAID',
            soldAt: { gte: lookbackStart, lt: todayStart },
          },
          select: { grandTotal: true },
        }),
        this.prisma.supplierInvoice.findMany({
          where: { tenantId, status: 'PENDING', dueDate: { lt: todayStart } },
          select: { id: true },
        }),
        this.prisma.supplierInvoice.findMany({
          where: {
            tenantId,
            status: 'PENDING',
            dueDate: { gte: todayStart, lte: invoicesDueSoonEnd },
          },
          select: { id: true },
        }),
      ]);

      const todayTotal = todaySales.reduce(
        (acc, s) => acc + Number(s.grandTotal),
        0,
      );
      const last7Total = last7DaysSales.reduce(
        (acc, s) => acc + Number(s.grandTotal),
        0,
      );
      const avgDailyLast7 = LOOKBACK_DAYS > 0 ? last7Total / LOOKBACK_DAYS : 0;

      const indicators: OperationalStateResponse['indicators'] = {
        cash: {
          openSessionsCount: openCashSessions.length,
          hasOpenSession: openCashSessions.length > 0,
          oldestOpenAt:
            openCashSessions.length > 0
              ? openCashSessions[0].openedAt.toISOString()
              : null,
        },
        inventory: {
          lowStockCount: lowStockProducts.length,
          zeroStockCount: zeroStockProducts.length,
        },
        quotes: {
          pendingCount: pendingQuotesCount,
          expiringSoonCount: expiringSoonQuotesCount,
          expiredCount: expiredQuotesCount,
        },
        sales: {
          todayCount: todaySales.length,
          todayTotal,
          avgDailyTotalLast7: avgDailyLast7,
        },
        supplierInvoices: {
          overdueCount: overdueInvoices.length,
          dueSoonCount: dueSoonInvoices.length,
        },
      };

      const detectedAt = now.toISOString();
      const alerts: OperationalAlert[] = [];

      if (openCashSessions.length === 0) {
        alerts.push({
          code: 'CASH_NO_SESSION',
          severity: 'critical',
          priority: 1,
          title: 'Sin caja abierta',
          message:
            'No hay ninguna sesión de caja abierta. Abre la caja para poder registrar ventas.',
          area: 'cash',
          count: 0,
          actionLabel: 'Abrir caja',
          actionHref: '/cash',
          entityIds: [],
          detectedAt,
        });
      } else if (openCashSessions.length > 1) {
        alerts.push({
          code: 'CASH_MULTIPLE_OPEN',
          severity: 'high',
          priority: 2,
          title: 'Múltiples cajas abiertas',
          message: `Hay ${openCashSessions.length} sesiones de caja abiertas. Revisa y cierra las que no uses.`,
          area: 'cash',
          count: openCashSessions.length,
          actionLabel: 'Revisar sesiones de caja',
          actionHref: '/cash',
          entityIds: openCashSessions.map((s) => s.id),
          detectedAt,
        });
      }

      if (zeroStockProducts.length > 0) {
        alerts.push({
          code: 'STOCK_ZERO',
          severity: 'high',
          priority: 2,
          title: 'Productos sin stock',
          message: `${zeroStockProducts.length} producto(s) activo(s) tienen 0 unidades. No se pueden vender.`,
          area: 'inventory',
          count: zeroStockProducts.length,
          actionLabel: 'Ver productos sin stock',
          actionHref: '/products?zeroStock=true',
          entityIds: zeroStockProducts.map((p) => p.id),
          detectedAt,
        });
      }

      if (lowStockProducts.length > 0) {
        alerts.push({
          code: 'STOCK_LOW',
          severity: 'medium',
          priority: 4,
          title: 'Stock bajo',
          message: `${lowStockProducts.length} producto(s) con stock ≤ ${LOW_STOCK_THRESHOLD}. Considera reponer.`,
          area: 'inventory',
          count: lowStockProducts.length,
          actionLabel: 'Ver productos con stock bajo',
          actionHref: '/products?lowStock=true',
          entityIds: lowStockProducts.map((p) => p.id),
          detectedAt,
        });
      }

      if (expiredQuotesCount > 0) {
        alerts.push({
          code: 'QUOTES_EXPIRED',
          severity: 'medium',
          priority: 3,
          title: 'Cotizaciones vencidas',
          message: `${expiredQuotesCount} cotización(es) vencieron sin convertirse. Actualiza vigencia o cancela.`,
          area: 'quotes',
          count: expiredQuotesCount,
          actionLabel: 'Ver cotizaciones vencidas',
          actionHref: '/quotes?status=EXPIRED',
          entityIds: [],
          detectedAt,
        });
      }

      if (expiringSoonQuotesCount > 0) {
        alerts.push({
          code: 'QUOTES_EXPIRING_SOON',
          severity: 'low',
          priority: 5,
          title: 'Cotizaciones por vencer',
          message: `${expiringSoonQuotesCount} cotización(es) vencen en los próximos ${QUOTES_EXPIRING_DAYS} días.`,
          area: 'quotes',
          count: expiringSoonQuotesCount,
          actionLabel: 'Ver cotizaciones',
          actionHref: '/quotes',
          entityIds: [],
          detectedAt,
        });
      }

      if (todaySales.length === 0) {
        alerts.push({
          code: 'SALES_ANOMALY_ZERO',
          severity: 'medium',
          priority: 4,
          title: 'Sin ventas hoy',
          message:
            'No se han registrado ventas pagadas hoy. Revisa caja o registra ventas.',
          area: 'sales',
          count: 0,
          actionLabel: 'Ir a ventas',
          actionHref: '/sales',
          entityIds: [],
          detectedAt,
        });
      }

      if (overdueInvoices.length > 0) {
        alerts.push({
          code: 'INVOICES_OVERDUE',
          severity: 'high',
          priority: 2,
          title: 'Facturas proveedor vencidas',
          message: `${overdueInvoices.length} factura(s) de proveedor vencida(s). Pagar o renegociar.`,
          area: 'supplierInvoices',
          count: overdueInvoices.length,
          actionLabel: 'Ver facturas vencidas',
          actionHref: '/supplier-invoices?overdue=true',
          entityIds: overdueInvoices.map((i) => i.id),
          detectedAt,
        });
      }

      if (dueSoonInvoices.length > 0) {
        alerts.push({
          code: 'INVOICES_DUE_SOON',
          severity: 'low',
          priority: 5,
          title: 'Facturas por vencer',
          message: `${dueSoonInvoices.length} factura(s) de proveedor vencen en los próximos ${INVOICES_DUE_SOON_DAYS} días.`,
          area: 'supplierInvoices',
          count: dueSoonInvoices.length,
          actionLabel: 'Ver facturas proveedor',
          actionHref: '/supplier-invoices',
          entityIds: dueSoonInvoices.map((i) => i.id),
          detectedAt,
        });
      }

      alerts.sort((a, b) => a.priority - b.priority);

      return { indicators, alerts };
    });
  }

  /**
   * Indicadores accionables: insight + acción sugerida + enlace.
   * Productos con pérdida, sin rotación, facturas vencidas, margen bajo.
   */
  async getActionableIndicators(
    dto: ActionableIndicatorsDto = {},
    tenantId: string,
  ): Promise<ActionableIndicatorsResponse> {
    return this.wrapReport(async () => {
      const days = Math.min(dto.days ?? 30, 365);
      const top = Math.min(dto.top ?? 10, 50);
      let periodStart: Date;
      let periodEnd: Date;
      let periodDays: number;
      if (dto.startDate && dto.endDate) {
        periodStart = new Date(dto.startDate);
        periodEnd = new Date(dto.endDate);
        periodEnd.setHours(23, 59, 59, 999);
        if (periodStart > periodEnd) {
          throw new BadRequestException(
            'La fecha de inicio no puede ser mayor que la de fin',
          );
        }
        periodDays = Math.ceil(
          (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
        );
      } else {
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - days);
        periodEnd = new Date();
        periodDays = days;
      }
      const soldAtRange = { gte: periodStart, lte: periodEnd };
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const detectedAt = now.toISOString();
      const indicators: ActionableIndicator[] = [];
      const TARGET_MARGIN_PCT = 15;

      // 1) Productos con pérdida (vendidos por debajo del costo)
      const saleItemsWithProduct = await this.prisma.saleItem.findMany({
        where: {
          sale: {
            tenantId,
            status: 'PAID',
            soldAt: soldAtRange,
          },
        },
        include: { product: { select: { id: true, name: true, cost: true } } },
      });

      const lossByProduct = new Map<
        string,
        { name: string; lossAmount: number; units: number; cost: number }
      >();
      for (const item of saleItemsWithProduct) {
        const cost = Number(item.product.cost);
        const unitPrice = Number(item.unitPrice);
        if (unitPrice >= cost) continue;
        const lossAmount = (cost - unitPrice) * item.qty;
        const existing = lossByProduct.get(item.productId);
        if (existing) {
          existing.lossAmount += lossAmount;
          existing.units += item.qty;
        } else {
          lossByProduct.set(item.productId, {
            name: item.product.name,
            lossAmount,
            units: item.qty,
            cost,
          });
        }
      }

      if (lossByProduct.size > 0) {
        const lossItems = Array.from(lossByProduct.entries())
          .sort((a, b) => b[1].lossAmount - a[1].lossAmount)
          .slice(0, top)
          .map(
            ([id, v]): ActionableIndicatorItem => ({
              id,
              name: v.name,
              value: `Pérdida $${Math.round(v.lossAmount).toLocaleString()}`,
              suggestedPrice:
                v.cost > 0
                  ? Math.ceil(v.cost / (1 - TARGET_MARGIN_PCT / 100))
                  : undefined,
            }),
          );
        const totalLoss = Array.from(lossByProduct.values()).reduce(
          (acc, v) => acc + v.lossAmount,
          0,
        );
        indicators.push({
          code: 'PRODUCTS_LOSS',
          title: 'Productos vendidos con pérdida',
          insight: `${lossByProduct.size} producto(s) se vendieron por debajo del costo en los últimos ${days} días.`,
          metric: `$${Math.round(totalLoss).toLocaleString()} pérdida`,
          severity: 'high',
          suggestedAction: 'Revisar precio o costo de estos productos.',
          actionLabel: 'Ver productos',
          actionHref: '/products',
          items: lossItems,
          detectedAt,
        });
      }

      // 2) Productos sin rotación (no vendidos en el periodo)
      const productIdsSold = await this.prisma.saleItem.findMany({
        where: {
          sale: {
            tenantId,
            status: 'PAID',
            soldAt: soldAtRange,
          },
        },
        select: { productId: true },
        distinct: ['productId'],
      });
      const soldIds = new Set(productIdsSold.map((p) => p.productId));
      const noRotationProducts = await this.prisma.product.findMany({
        where: {
          tenantId,
          isActive: true,
          id: { notIn: Array.from(soldIds) },
        },
        select: {
          id: true,
          name: true,
          stock: { select: { qtyOnHand: true } },
        },
        take: top,
      });

      if (noRotationProducts.length > 0) {
        const totalNoRotation = await this.prisma.product.count({
          where: {
            tenantId,
            isActive: true,
            id: { notIn: Array.from(soldIds) },
          },
        });
        indicators.push({
          code: 'PRODUCTS_NO_ROTATION',
          title: 'Productos sin rotación',
          insight: `${totalNoRotation} producto(s) activo(s) no se vendieron en los últimos ${days} días.`,
          metric: totalNoRotation,
          severity: 'medium',
          suggestedAction:
            'Promocionar, bajar precio o descontinuar según el caso.',
          actionLabel: 'Ver productos sin rotación',
          actionHref: '/reports?tab=no-rotation',
          items: noRotationProducts.map((p) => ({
            id: p.id,
            name: p.name,
            stock: p.stock?.qtyOnHand ?? 0,
          })),
          detectedAt,
        });
      }

      // 3) Facturas proveedor vencidas
      const overdueInvoices = await this.prisma.supplierInvoice.findMany({
        where: { tenantId, status: 'PENDING', dueDate: { lt: todayStart } },
        include: { supplier: { select: { name: true } } },
        take: top,
        orderBy: { dueDate: 'asc' },
      });

      if (overdueInvoices.length > 0) {
        const totalOverdue = await this.prisma.supplierInvoice.count({
          where: { tenantId, status: 'PENDING', dueDate: { lt: todayStart } },
        });
        const pendingTotal = overdueInvoices.reduce(
          (acc, inv) => acc + Number(inv.grandTotal) - Number(inv.paidAmount),
          0,
        );
        indicators.push({
          code: 'INVOICES_OVERDUE',
          title: 'Facturas proveedor vencidas',
          insight: `${totalOverdue} factura(s) de proveedor vencida(s). Monto pendiente relevante en la muestra.`,
          metric: totalOverdue,
          severity: 'high',
          suggestedAction: 'Pagar o renegociar con el proveedor.',
          actionLabel: 'Ver facturas vencidas',
          actionHref: '/supplier-invoices?overdue=true',
          items: overdueInvoices.map((inv) => ({
            id: inv.id,
            name: inv.supplier.name,
            value: `#${inv.invoiceNumber} - $${(Number(inv.grandTotal) - Number(inv.paidAmount)).toLocaleString()} pendiente`,
          })),
          detectedAt,
        });
      }

      // 4) Productos con margen muy bajo (< 10 %)
      const allProducts = await this.prisma.product.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, cost: true, price: true },
      });
      const lowMarginProducts = allProducts.filter((p) => {
        const price = Number(p.price);
        const cost = Number(p.cost);
        if (price <= 0) return false;
        const marginPct = ((price - cost) / price) * 100;
        return marginPct < 10 && marginPct >= 0;
      });

      if (lowMarginProducts.length > 0) {
        const topLowMargin = lowMarginProducts
          .slice(0, top)
          .map((p): ActionableIndicatorItem => {
            const cost = Number(p.cost);
            const price = Number(p.price);
            const marginPct = price > 0 ? ((price - cost) / price) * 100 : 0;
            return {
              id: p.id,
              name: p.name,
              value: `Margen ${marginPct.toFixed(1)}%`,
              suggestedPrice:
                cost > 0
                  ? Math.ceil(cost / (1 - TARGET_MARGIN_PCT / 100))
                  : undefined,
            };
          });
        indicators.push({
          code: 'PRODUCTS_LOW_MARGIN',
          title: 'Productos con margen bajo',
          insight: `${lowMarginProducts.length} producto(s) con margen menor al 10 %.`,
          metric: lowMarginProducts.length,
          severity: 'medium',
          suggestedAction: 'Subir precio o negociar costo con el proveedor.',
          actionLabel: 'Ver productos',
          actionHref: '/products',
          items: topLowMargin,
          detectedAt,
        });
      }

      // 4b) Anomalía Fase 2: margen de producto muy por debajo de la media (estadística descriptiva)
      const margins = allProducts
        .filter((p) => Number(p.price) > 0)
        .map((p) => {
          const price = Number(p.price);
          const cost = Number(p.cost);
          return ((price - cost) / price) * 100;
        })
        .filter((m) => Number.isFinite(m) && m >= 0);
      const avgMargin =
        margins.length > 0
          ? margins.reduce((a, b) => a + b, 0) / margins.length
          : 0;
      const MARGIN_BELOW_AVG_THRESHOLD = 0.5;
      const marginBelowAvgProducts = allProducts.filter((p) => {
        const price = Number(p.price);
        const cost = Number(p.cost);
        if (price <= 0) return false;
        const marginPct = ((price - cost) / price) * 100;
        if (!Number.isFinite(marginPct) || marginPct < 0) return false;
        return (
          avgMargin > 0 && marginPct < avgMargin * MARGIN_BELOW_AVG_THRESHOLD
        );
      });

      if (marginBelowAvgProducts.length > 0 && avgMargin > 0) {
        const topBelowAvg = marginBelowAvgProducts.slice(0, top).map(
          (p): ActionableIndicatorItem => ({
            id: p.id,
            name: p.name,
            value: `Margen ${(((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100).toFixed(1)}% (media ${avgMargin.toFixed(1)}%)`,
          }),
        );
        indicators.push({
          code: 'MARGIN_BELOW_AVERAGE',
          title: 'Margen por debajo de la media',
          insight: `${marginBelowAvgProducts.length} producto(s) con margen muy por debajo de la media (media ${avgMargin.toFixed(1)} %).`,
          metric: marginBelowAvgProducts.length,
          severity: 'low',
          suggestedAction:
            'Revisar precio o costo; alinear con la media del catálogo.',
          actionLabel: 'Ver productos',
          actionHref: '/products',
          items: topBelowAvg,
          detectedAt,
        });
      }

      // 4c) Recomendación de reorden: productos con pocos días de stock según ventas recientes (regla simple, sin ML)
      const reorderDaysWindow = 30;
      const reorderDaysThreshold = 7;
      const reorderPeriodStart = new Date();
      reorderPeriodStart.setDate(
        reorderPeriodStart.getDate() - reorderDaysWindow,
      );
      const salesForReorder = await this.prisma.saleItem.findMany({
        where: {
          sale: {
            tenantId,
            status: 'PAID',
            soldAt: { gte: reorderPeriodStart },
          },
        },
        select: { productId: true, qty: true },
      });
      const qtySoldByProduct = new Map<string, number>();
      for (const item of salesForReorder) {
        const current = qtySoldByProduct.get(item.productId) ?? 0;
        qtySoldByProduct.set(item.productId, current + item.qty);
      }
      const stockBalances = await this.prisma.stockBalance.findMany({
        where: { productId: { in: Array.from(qtySoldByProduct.keys()) } },
        select: { productId: true, qtyOnHand: true },
      });
      const reorderCandidates: {
        productId: string;
        daysOfStock: number;
        qtyOnHand: number;
      }[] = [];
      for (const sb of stockBalances) {
        const totalSold = qtySoldByProduct.get(sb.productId) ?? 0;
        const avgDailySales = totalSold / reorderDaysWindow;
        if (avgDailySales <= 0) continue;
        const daysOfStock = sb.qtyOnHand / avgDailySales;
        if (daysOfStock >= 0 && daysOfStock < reorderDaysThreshold) {
          reorderCandidates.push({
            productId: sb.productId,
            daysOfStock,
            qtyOnHand: sb.qtyOnHand,
          });
        }
      }
      if (reorderCandidates.length > 0) {
        reorderCandidates.sort((a, b) => a.daysOfStock - b.daysOfStock);
        const reorderProductIds = reorderCandidates
          .slice(0, top)
          .map((c) => c.productId);
        const reorderProducts = await this.prisma.product.findMany({
          where: { id: { in: reorderProductIds } },
          select: { id: true, name: true },
        });
        const nameById = new Map(reorderProducts.map((p) => [p.id, p.name]));
        const reorderItems = reorderCandidates.slice(0, top).map(
          (c): ActionableIndicatorItem => ({
            id: c.productId,
            name: nameById.get(c.productId) ?? c.productId,
            value: `~${Math.max(0, Math.round(c.daysOfStock))} días de stock (${c.qtyOnHand} ud.)`,
          }),
        );
        indicators.push({
          code: 'REORDER_SUGGESTION',
          title: 'Productos a reponer pronto',
          insight: `${reorderCandidates.length} producto(s) con menos de ${reorderDaysThreshold} días de stock según ventas de los últimos ${reorderDaysWindow} días.`,
          metric: reorderCandidates.length,
          severity: 'medium',
          suggestedAction:
            'Evaluar pedido a proveedor para evitar quiebre de stock.',
          actionLabel: 'Ver inventario',
          actionHref: '/inventory',
          items: reorderItems,
          detectedAt,
        });
      }

      // 5) Proveedores menos competitivos (precio por encima del promedio por producto)
      const poItems = await this.prisma.purchaseOrderItem.findMany({
        where: {
          purchaseOrder: {
            orderDate: { gte: periodStart, lte: periodEnd },
          },
        },
        include: {
          purchaseOrder: { select: { supplierId: true } },
          product: { select: { id: true, name: true } },
        },
      });

      const byProductSupplier = new Map<
        string,
        { totalCost: number; totalQty: number }
      >();
      for (const item of poItems) {
        const key = `${item.productId}-${item.purchaseOrder.supplierId}`;
        const cost = Number(item.unitCost) * item.qty;
        const existing = byProductSupplier.get(key);
        if (existing) {
          existing.totalCost += cost;
          existing.totalQty += item.qty;
        } else {
          byProductSupplier.set(key, {
            totalCost: cost,
            totalQty: item.qty,
          });
        }
      }

      const productTotalCost = new Map<string, { cost: number; qty: number }>();
      for (const [key, v] of byProductSupplier) {
        const productId = key.split('-')[0];
        const existing = productTotalCost.get(productId);
        if (existing) {
          existing.cost += v.totalCost;
          existing.qty += v.totalQty;
        } else {
          productTotalCost.set(productId, {
            cost: v.totalCost,
            qty: v.totalQty,
          });
        }
      }
      const productAvgCost = new Map<string, number>();
      for (const [productId, { cost, qty }] of productTotalCost) {
        productAvgCost.set(productId, qty > 0 ? cost / qty : 0);
      }

      const supplierAboveAvg = new Map<
        string,
        { name: string; products: string[]; count: number }
      >();
      const supplierIds = new Set(
        poItems.map((i) => i.purchaseOrder.supplierId),
      );
      const suppliers = await this.prisma.supplier.findMany({
        where: { id: { in: Array.from(supplierIds) } },
        select: { id: true, name: true },
      });
      const supplierNames = new Map(suppliers.map((s) => [s.id, s.name]));

      const productIdToName = new Map(
        poItems
          .filter((i) => i.product?.name)
          .map((i) => [i.productId, i.product.name]),
      );
      for (const [key, v] of byProductSupplier) {
        const [productId, supplierId] = key.split('-');
        const productAvg = productAvgCost.get(productId);
        if (productAvg === undefined || productAvg <= 0) continue;
        const avgCost = v.totalCost / v.totalQty;
        if (avgCost <= productAvg * 1.05) continue;
        const supplierName = supplierNames.get(supplierId) ?? supplierId;
        const existing = supplierAboveAvg.get(supplierId);
        const productName = productIdToName.get(productId) ?? productId;
        if (existing) {
          if (!existing.products.includes(productName)) {
            existing.products.push(productName);
            existing.count += 1;
          }
        } else {
          supplierAboveAvg.set(supplierId, {
            name: supplierName,
            products: [productName],
            count: 1,
          });
        }
      }

      if (supplierAboveAvg.size > 0) {
        const sortedSuppliers = Array.from(supplierAboveAvg.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, top);
        indicators.push({
          code: 'SUPPLIERS_LESS_COMPETITIVE',
          title: 'Proveedores menos competitivos en precio',
          insight: `${supplierAboveAvg.size} proveedor(es) con precio por encima del promedio en al menos un producto (últimos ${days} días).`,
          metric: supplierAboveAvg.size,
          severity: 'medium',
          suggestedAction: 'Renegociar o evaluar cambio de proveedor.',
          actionLabel: 'Ver proveedores',
          actionHref: '/suppliers',
          items: sortedSuppliers.map(([id, v]) => ({
            id,
            name: v.name,
            value: `${v.count} producto(s) por encima del promedio`,
          })),
          detectedAt,
        });
      }

      // 5b) Anomalía simple: ventas hoy vs media diaria últimos 7 días (Fase 2 IA – estadística descriptiva)
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const salesLast7Days = await this.prisma.sale.findMany({
        where: {
          status: 'PAID',
          soldAt: { gte: sevenDaysAgo, lt: todayStart },
        },
        select: { soldAt: true, grandTotal: true },
      });
      const totalLast7 = salesLast7Days.reduce(
        (acc, s) => acc + Number(s.grandTotal),
        0,
      );
      const avgDaily7 = totalLast7 / 7;

      const salesToday = await this.prisma.sale.findMany({
        where: {
          status: 'PAID',
          soldAt: { gte: todayStart },
        },
        select: { grandTotal: true },
      });
      const todayTotal = salesToday.reduce(
        (acc, s) => acc + Number(s.grandTotal),
        0,
      );

      const ANOMALY_THRESHOLD = 0.5;
      if (avgDaily7 > 0 && todayTotal < avgDaily7 * ANOMALY_THRESHOLD) {
        indicators.push({
          code: 'SALES_ANOMALY_TODAY',
          title: 'Ventas hoy por debajo de lo habitual',
          insight: `Ventas de hoy ($${Math.round(todayTotal).toLocaleString()}) están por debajo del 50 % de la media diaria de los últimos 7 días ($${Math.round(avgDaily7).toLocaleString()}/día).`,
          metric: `$${Math.round(todayTotal).toLocaleString()} hoy`,
          severity: 'medium',
          suggestedAction:
            'Revisar causas (horario, disponibilidad, promociones) o considerar campaña.',
          actionLabel: 'Ver ventas',
          actionHref: '/sales',
          items: [],
          detectedAt,
        });
      }

      // 6) Patrones de venta por empleado (ventas por usuario)
      const salesByUser = await this.prisma.sale.findMany({
        where: {
          status: 'PAID',
          soldAt: soldAtRange,
          createdByUserId: { not: null },
        },
        select: {
          id: true,
          grandTotal: true,
          discountTotal: true,
          createdByUserId: true,
        },
      });

      const userSales = new Map<
        string,
        { total: number; count: number; discounts: number }
      >();
      for (const s of salesByUser) {
        const uid = s.createdByUserId!;
        const total = Number(s.grandTotal);
        const discount = Number(s.discountTotal ?? 0);
        const existing = userSales.get(uid);
        if (existing) {
          existing.total += total;
          existing.count += 1;
          existing.discounts += discount;
        } else {
          userSales.set(uid, { total, count: 1, discounts: discount });
        }
      }

      if (userSales.size > 0) {
        const userIds = Array.from(userSales.keys());
        const users = await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        });
        const userEmails = new Map(users.map((u) => [u.id, u.email]));

        const items = Array.from(userSales.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, top)
          .map(
            ([uid, v]): ActionableIndicatorItem => ({
              id: uid,
              name: userEmails.get(uid) ?? uid,
              value: `${v.count} ventas · $${Math.round(v.total).toLocaleString()} total`,
              totalSales: v.total,
            }),
          );

        const totalSales = Array.from(userSales.values()).reduce(
          (acc, v) => acc + v.total,
          0,
        );
        indicators.push({
          code: 'SALES_BY_EMPLOYEE',
          title: 'Ventas por empleado',
          insight: `${userSales.size} usuario(s) con ventas en el período (${periodDays} días). Total $${Math.round(totalSales).toLocaleString()}.`,
          metric: totalSales,
          severity: 'info',
          suggestedAction:
            'Revisar desempeño o políticas de descuento por empleado.',
          actionLabel: 'Ver ventas por empleado',
          actionHref: '/reports?tab=sales-by-employee',
          items,
          detectedAt,
        });
      }

      // 7) Pronóstico de demanda: media ponderada (más peso a días recientes) × 7 y × 30 días
      const salesForForecast = await this.prisma.sale.findMany({
        where: {
          status: 'PAID',
          soldAt: soldAtRange,
        },
        select: { soldAt: true, grandTotal: true },
      });
      const totalByDay = new Map<string, number>();
      for (const s of salesForForecast) {
        const day = s.soldAt.toISOString().slice(0, 10);
        totalByDay.set(day, (totalByDay.get(day) ?? 0) + Number(s.grandTotal));
      }
      const sortedDays = Array.from(totalByDay.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      );
      let avgDailySales = 0;
      if (sortedDays.length > 0) {
        const weights = sortedDays.map((_, i) => i + 1);
        const sumWeights = weights.reduce((a, b) => a + b, 0);
        const weightedSum = sortedDays.reduce(
          (acc, [_, total], i) => acc + total * weights[i],
          0,
        );
        avgDailySales = sumWeights > 0 ? weightedSum / sumWeights : 0;
        if (avgDailySales <= 0) {
          const sumPeriod = sortedDays.reduce((a, [, t]) => a + t, 0);
          avgDailySales =
            sortedDays.length > 0 ? sumPeriod / sortedDays.length : 0;
        }
      }
      if (avgDailySales > 0) {
        const forecast7 = Math.round(avgDailySales * 7);
        const forecast30 = Math.round(avgDailySales * 30);
        indicators.push({
          code: 'DEMAND_FORECAST',
          title: 'Pronóstico de demanda (ventas esperadas)',
          insight: `Con la media diaria ponderada (más peso a días recientes) de los últimos ${days} días ($${Math.round(avgDailySales).toLocaleString()}/día), las ventas esperadas son: próximos 7 días ~$${forecast7.toLocaleString()}, próximos 30 días ~$${forecast30.toLocaleString()}.`,
          metric: `~$${forecast7.toLocaleString()} (7 d) · ~$${forecast30.toLocaleString()} (30 d)`,
          severity: 'info',
          suggestedAction:
            'Usar como referencia para pedidos a proveedor y planificación de caja.',
          actionLabel: 'Ver ventas',
          actionHref: '/sales',
          items: [
            {
              id: '7d',
              name: 'Próximos 7 días',
              value: `~$${forecast7.toLocaleString()}`,
            },
            {
              id: '30d',
              name: 'Próximos 30 días',
              value: `~$${forecast30.toLocaleString()}`,
            },
          ],
          detectedAt,
        });
      }

      // 8) Clustering de clientes: inactivos (>60 días sin compra), premium (top 20 % por monto), regulares
      const customerSales = await this.prisma.sale.findMany({
        where: {
          status: 'PAID',
          soldAt: soldAtRange,
          customerId: { not: null },
        },
        select: {
          customerId: true,
          grandTotal: true,
          soldAt: true,
          customer: { select: { id: true, name: true } },
        },
      });
      const customerStatsMap = new Map<
        string,
        { name: string; total: number; lastSale: Date }
      >();
      for (const s of customerSales) {
        const cid = s.customerId!;
        const existing = customerStatsMap.get(cid);
        const total = Number(s.grandTotal);
        const soldAt = s.soldAt ?? new Date(0);
        if (existing) {
          existing.total += total;
          if (soldAt > existing.lastSale) existing.lastSale = soldAt;
        } else {
          customerStatsMap.set(cid, {
            name: s.customer?.name ?? cid,
            total,
            lastSale: soldAt,
          });
        }
      }
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const sortedByAmount = Array.from(customerStatsMap.entries())
        .filter(([, v]) => v.total > 0)
        .sort((a, b) => b[1].total - a[1].total);
      const top20Pct = Math.max(1, Math.ceil(sortedByAmount.length * 0.2));
      const premiumIds = new Set(
        sortedByAmount.slice(0, top20Pct).map(([id]) => id),
      );
      let inactivos = 0;
      let premium = 0;
      let regulares = 0;
      const segmentItems: ActionableIndicatorItem[] = [];
      for (const [id, v] of sortedByAmount) {
        if (v.lastSale < sixtyDaysAgo) {
          inactivos++;
          if (
            segmentItems.length < top &&
            segmentItems.every((i) => i.id !== id)
          )
            segmentItems.push({
              id,
              name: v.name,
              value: 'Inactivo (>60 días sin compra)',
            });
        } else if (premiumIds.has(id)) {
          premium++;
        } else {
          regulares++;
        }
      }
      if (customerStatsMap.size > 0) {
        indicators.push({
          code: 'CUSTOMER_SEGMENTS',
          title: 'Segmentación de clientes',
          insight: `En los últimos ${days} días: ${premium} cliente(s) premium (top 20 % por monto), ${regulares} regulares, ${inactivos} inactivos (sin compra en 60+ días).`,
          metric: `${premium} premium · ${regulares} regulares · ${inactivos} inactivos`,
          severity: 'info',
          suggestedAction:
            'Reactivar inactivos con ofertas; priorizar servicio a premium.',
          actionLabel: 'Ver clientes',
          actionHref: '/customers',
          items:
            segmentItems.length > 0
              ? segmentItems
              : [
                  {
                    id: 'premium',
                    name: 'Premium (top 20 %)',
                    value: `${premium} clientes`,
                  },
                  {
                    id: 'inactivos',
                    name: 'Inactivos (60+ días)',
                    value: `${inactivos} clientes`,
                  },
                ],
          detectedAt,
        });
      }

      // 9) Score de proveedores (precio + cumplimiento: entregas a tiempo, facturas al día)
      const posWithSupplier = await this.prisma.purchaseOrder.findMany({
        where: { orderDate: { gte: periodStart, lte: periodEnd } },
        select: {
          supplierId: true,
          expectedDate: true,
          receivedDate: true,
          status: true,
        },
      });
      const supplierInvoiceStats = await this.prisma.supplierInvoice.findMany({
        where: { status: 'PENDING' },
        select: { supplierId: true, dueDate: true },
      });
      const supplierScores = new Map<
        string,
        {
          name: string;
          priceAboveAvg: boolean;
          onTimePct: number;
          overdueCount: number;
        }
      >();
      const supplierIdsFromPo = new Set(
        posWithSupplier.map((p) => p.supplierId),
      );
      const suppliersForScore = await this.prisma.supplier.findMany({
        where: { id: { in: Array.from(supplierIdsFromPo) } },
        select: { id: true, name: true },
      });
      const supplierNameMap = new Map(
        suppliersForScore.map((s) => [s.id, s.name]),
      );
      for (const sid of supplierIdsFromPo) {
        const pos = posWithSupplier.filter((p) => p.supplierId === sid);
        const received = pos.filter((p) => p.receivedDate != null);
        const onTime = received.filter(
          (p) =>
            p.expectedDate &&
            p.receivedDate &&
            p.receivedDate <= new Date(p.expectedDate.getTime() + 86400000),
        );
        const onTimePct =
          received.length > 0 ? (onTime.length / received.length) * 100 : 100;
        const overdueCount = supplierInvoiceStats.filter(
          (i) => i.supplierId === sid && i.dueDate < todayStart,
        ).length;
        const priceAboveAvg = supplierAboveAvg.has(sid);
        supplierScores.set(sid, {
          name: supplierNameMap.get(sid) ?? sid,
          priceAboveAvg,
          onTimePct,
          overdueCount,
        });
      }
      const scoreList = Array.from(supplierScores.entries())
        .map(([id, v]) => {
          let score = 5;
          if (v.priceAboveAvg) score -= 1;
          if (v.onTimePct < 80) score -= 1;
          if (v.overdueCount > 0) score -= 1;
          score = Math.max(1, score);
          return {
            id,
            name: v.name,
            score,
            value: `Score ${score}/5 · ${v.onTimePct.toFixed(0)}% entregas a tiempo${v.overdueCount > 0 ? ` · ${v.overdueCount} factura(s) vencida(s)` : ''}`,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, top)
        .map(({ id, name, value }) => ({ id, name, value }));
      if (scoreList.length > 0) {
        indicators.push({
          code: 'SUPPLIER_SCORE',
          title: 'Score de proveedores',
          insight: `Evaluación por precio vs promedio, entregas a tiempo y facturas al día (últimos ${days} días).`,
          metric: `${scoreList.length} proveedor(es) evaluados`,
          severity: 'info',
          suggestedAction:
            'Priorizar proveedores con score alto; renegociar o revisar los de score bajo.',
          actionLabel: 'Ver proveedores',
          actionHref: '/suppliers',
          items: scoreList.map((s) => ({
            id: s.id,
            name: s.name,
            value: s.value,
          })),
          detectedAt,
        });
      }

      return { periodDays, indicators };
    });
  }

  /**
   * Resumen del dashboard en lenguaje natural (IA Fase 3).
   * Si OPENAI_API_KEY está configurado, usa LLM para una o dos frases; si no, devuelve fallback (primeros insights).
   */
  async getDashboardSummary(dto: ActionableIndicatorsDto = {}, tenantId: string): Promise<{
    summary: string;
    source: 'llm' | 'fallback';
  }> {
    const { indicators } = await this.getActionableIndicators(dto, tenantId);
    const insights = indicators.map((i) => i.insight);
    const fallback =
      insights.length > 0
        ? insights.slice(0, 3).join('. ')
        : 'No hay indicadores destacados en este periodo.';

    const apiKey = this.config.get<string>('OPENAI_API_KEY', '')?.trim();
    if (!apiKey) {
      this.logger.log(
        'Resumen del día: OPENAI_API_KEY no configurada, usando resumen automático.',
      );
      return { summary: fallback, source: 'fallback' };
    }

    const text = insights.join('. ');
    if (!text) {
      return { summary: fallback, source: 'fallback' };
    }

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: `Resume en una o dos frases en español, para un gerente de negocio, los siguientes indicadores. Sé directo y accionable:\n\n${text.slice(0, 2000)}`,
            },
          ],
          max_tokens: 150,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn(`OpenAI API error: ${res.status} ${errText}`);
        return { summary: fallback, source: 'fallback' };
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        return { summary: content, source: 'llm' };
      }
    } catch (err) {
      this.logger.warn(
        `Dashboard summary LLM failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { summary: fallback, source: 'fallback' };
  }

  /**
   * Clustering de clientes con K-means (opcional IA).
   * Segmenta por: monto total en periodo, días desde última compra, cantidad de compras.
   * Devuelve k clusters con lista de clientes por segmento.
   */
  async getCustomerClusters(dto: CustomerClustersDto = {}, tenantId: string): Promise<{
    periodDays: number;
    k: number;
    clusters: Array<{
      clusterIndex: number;
      label: string;
      suggestedLabel: string;
      description: string;
      customers: Array<{ id: string; name: string }>;
      avgAmount: number;
      avgDaysAgo: number;
      avgCount: number;
    }>;
  }> {
    const days = Math.min(dto.days ?? 90, 365);
    const k = Math.min(Math.max(dto.k ?? 3, 2), 10);
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);

    const sales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        status: 'PAID',
        soldAt: { gte: periodStart },
        customerId: { not: null },
      },
      select: {
        customerId: true,
        grandTotal: true,
        soldAt: true,
        customer: { select: { id: true, name: true } },
      },
    });

    const customerStats = new Map<
      string,
      { name: string; totalAmount: number; lastSale: Date; count: number }
    >();
    for (const s of sales) {
      const cid = s.customerId!;
      const total = Number(s.grandTotal);
      const soldAt = s.soldAt ?? new Date(0);
      const existing = customerStats.get(cid);
      if (existing) {
        existing.totalAmount += total;
        existing.count += 1;
        if (soldAt > existing.lastSale) existing.lastSale = soldAt;
      } else {
        customerStats.set(cid, {
          name: s.customer?.name ?? cid,
          totalAmount: total,
          lastSale: soldAt,
          count: 1,
        });
      }
    }

    const entries = Array.from(customerStats.entries());
    if (entries.length < k) {
      return {
        periodDays: days,
        k,
        clusters: [],
      };
    }

    const customerIds = entries.map(([id]) => id);
    const totalAmounts = entries.map(([, v]) => v.totalAmount);
    const daysAgo = entries.map(
      ([, v]) => (now.getTime() - v.lastSale.getTime()) / (1000 * 60 * 60 * 24),
    );
    const counts = entries.map(([, v]) => v.count);

    const minMax = (arr: number[]) => {
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      const range = max - min || 1;
      return { min, range };
    };
    const norm = (arr: number[]) => {
      const { min, range } = minMax(arr);
      return arr.map((x) => (x - min) / range);
    };

    const totalNorm = norm(totalAmounts);
    const daysNorm = norm(daysAgo);
    const countNorm = norm(counts);

    const data = customerIds.map((_, i) => [
      totalNorm[i],
      daysNorm[i],
      countNorm[i],
    ]);

    const result = kmeans(data, k, {});
    const clusterIndices = result.clusters;

    const clustersRaw: Array<{
      clusterIndex: number;
      label: string;
      customers: Array<{ id: string; name: string }>;
      avgAmount: number;
      avgDaysAgo: number;
      avgCount: number;
    }> = [];
    for (let c = 0; c < k; c++) {
      const indices = clusterIndices
        .map((cl, i) => (cl === c ? i : -1))
        .filter((i) => i >= 0);
      const customers = indices.map((i) => ({
        id: customerIds[i],
        name: entries[i][1].name,
      }));
      const avgAmount =
        indices.length > 0
          ? indices.reduce((a, i) => a + totalAmounts[i], 0) / indices.length
          : 0;
      const avgDaysAgo =
        indices.length > 0
          ? indices.reduce((a, i) => a + daysAgo[i], 0) / indices.length
          : 0;
      const avgCount =
        indices.length > 0
          ? indices.reduce((a, i) => a + counts[i], 0) / indices.length
          : 0;
      const label = `Segmento ${c + 1} (${customers.length} clientes, promedio $${Math.round(avgAmount).toLocaleString()})`;
      clustersRaw.push({
        clusterIndex: c,
        label,
        customers,
        avgAmount,
        avgDaysAgo,
        avgCount,
      });
    }

    // Ordenar por valor promedio (mayor primero) y asignar nombres intuitivos
    const namesByRank: Record<number, string> = {
      0: 'Alto valor',
      1: 'Valor medio',
      2: 'Por reactivar',
      3: 'Valor bajo',
    };
    const descriptionsByRank: Record<number, string> = {
      0: 'Clientes que más compran en el período. Prioriza ofertas y fidelización.',
      1: 'Clientes con compras moderadas. Oportunidad de aumentar frecuencia o ticket.',
      2: 'Clientes con menor actividad o que llevan más tiempo sin comprar. Campañas de reactivación.',
      3: 'Clientes con bajo volumen de compras. Evaluar promociones o contacto.',
    };
    const clustersOut = clustersRaw
      .sort((a, b) => b.avgAmount - a.avgAmount)
      .map((cluster, rank) => {
        const suggestedLabel = namesByRank[rank] ?? `Segmento ${rank + 1}`;
        const description =
          descriptionsByRank[rank] ??
          `Segmento por comportamiento de compra (${cluster.customers.length} clientes).`;
        return {
          clusterIndex: cluster.clusterIndex,
          label: cluster.label,
          suggestedLabel,
          description,
          customers: cluster.customers,
          avgAmount: cluster.avgAmount,
          avgDaysAgo: cluster.avgDaysAgo,
          avgCount: cluster.avgCount,
        };
      });

    return { periodDays: days, k, clusters: clustersOut };
  }

  /**
   * Exporta datos por entidad a CSV (para descarga manual; resiliencia).
   * Filtrado por tenantId para aislamiento multi-tenant.
   */
  async exportAsCsv(
    dto: ExportReportDto,
    tenantId: string,
  ): Promise<{ csv: string; fileName: string }> {
    const limit = Math.min(dto.limit ?? 1000, 5000);
    const entity = dto.entity;

    if (entity === 'sales') {
      const where: Prisma.SaleWhereInput = { tenantId, status: 'PAID' };
      if (dto.startDate || dto.endDate) {
        where.soldAt = {};
        if (dto.startDate) where.soldAt.gte = new Date(dto.startDate);
        if (dto.endDate) where.soldAt.lte = new Date(dto.endDate);
      }
      const sales = await this.prisma.sale.findMany({
        where,
        select: {
          id: true,
          soldAt: true,
          subtotal: true,
          taxTotal: true,
          discountTotal: true,
          grandTotal: true,
          status: true,
          customer: true,
        },
        orderBy: { soldAt: 'desc' },
        take: limit,
      });
      const header =
        'id,fecha,cliente,subtotal,impuesto,descuento,total,estado\n';
      const rows = sales.map(
        (s) =>
          `${csvEscape(s.id)},${csvEscape(s.soldAt?.toISOString())},${csvEscape(s.customer?.name)},${csvEscape(s.subtotal)},${csvEscape(s.taxTotal)},${csvEscape(s.discountTotal)},${csvEscape(s.grandTotal)},${csvEscape(s.status)}`,
      );
      const csv = '\uFEFF' + header + rows.join('\n');
      const dateStr = new Date().toISOString().slice(0, 10);
      return { csv, fileName: `export-ventas-${dateStr}.csv` };
    }

    if (entity === 'customers') {
      const customers = await this.prisma.customer.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
        take: limit,
      });
      const header = 'id,nombre,tipo_doc,num_doc,email,telefono\n';
      const rows = customers.map(
        (c) =>
          `${csvEscape(c.id)},${csvEscape(c.name)},${csvEscape(c.docType)},${csvEscape(c.docNumber)},${csvEscape(c.email)},${csvEscape(c.phone)}`,
      );
      const csv = '\uFEFF' + header + rows.join('\n');
      const dateStr = new Date().toISOString().slice(0, 10);
      return { csv, fileName: `export-clientes-${dateStr}.csv` };
    }

    throw new BadRequestException(
      `Entidad no soportada para export: ${entity}`,
    );
  }
}
