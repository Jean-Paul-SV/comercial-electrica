import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalesReportDto } from './dto/sales-report.dto';
import { InventoryReportDto } from './dto/inventory-report.dto';
import { CashReportDto } from './dto/cash-report.dto';
import { CustomersReportDto } from './dto/customers-report.dto';
import { Prisma } from '@prisma/client';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getSalesReport(dto: SalesReportDto) {
    // Validar rango de fechas (máximo 1 año)
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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
      include: {
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

  async getInventoryReport(dto: InventoryReportDto) {
    const where: Prisma.ProductWhereInput = {
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

  async getCashReport(dto: CashReportDto) {
    // Validar rango de fechas (máximo 1 año)
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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

    const where: Prisma.CashSessionWhereInput = {};

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

    // Calcular estadísticas por sesión
    const sessionsWithStats = sessions.map((session) => {
      const movements = session.movements;
      const totalIn = movements
        .filter((m) => m.type === 'IN')
        .reduce((acc, m) => acc + Number(m.amount), 0);
      const totalOut = movements
        .filter((m) => m.type === 'OUT')
        .reduce((acc, m) => acc + Number(m.amount), 0);
      const netAmount = totalIn - totalOut;
      const expectedAmount = session.closedAt
        ? Number(session.closingAmount)
        : Number(session.openingAmount) + netAmount;
      const difference = session.closedAt
        ? Number(session.closingAmount) - expectedAmount
        : 0;

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
          netAmount,
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
        totalDifference: acc.totalDifference + s.difference,
      }),
      {
        totalSessions: 0,
        openSessions: 0,
        totalIn: 0,
        totalOut: 0,
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
        netAmount: totals.totalIn - totals.totalOut,
      },
      sessions: sessionsWithStats,
    };
  }

  async getCustomersReport(dto: CustomersReportDto) {
    // Validar rango de fechas (máximo 1 año)
    if (dto.startDate && dto.endDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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

    // Obtener ventas agrupadas por cliente
    const sales = await this.prisma.sale.findMany({
      where: {
        ...where,
        customerId: { not: null },
      },
      include: {
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

  async getDashboard() {
    // Cachear dashboard por 1 minuto (cambia frecuentemente pero no necesita ser en tiempo real)
    const cacheKey = this.cache.buildKey('dashboard', 'main');
    const cached = await this.cache.get(cacheKey);
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

    // Ventas del día
    const todaySales = await this.prisma.sale.findMany({
      where: {
        status: 'PAID',
        soldAt: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    const todaySalesTotal = todaySales.reduce(
      (acc, s) => acc + Number(s.grandTotal),
      0,
    );

    // Productos con stock bajo
    const lowStockProducts = await this.prisma.product.findMany({
      where: {
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
        closedAt: null,
      },
      include: {
        movements: true,
      },
    });

    // Cotizaciones pendientes (no convertidas ni canceladas)
    const pendingQuotes = await this.prisma.quote.count({
      where: {
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
      where: { isActive: true },
    });

    // Total de clientes
    const totalCustomers = await this.prisma.customer.count();

    const dashboard = {
      date: now.toISOString(),
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

    // Cachear por 1 minuto
    await this.cache.set(cacheKey, dashboard, 60);
    return dashboard;
  }
}
