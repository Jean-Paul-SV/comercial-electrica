import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: ValidationLimitsService,
    private readonly audit: AuditService,
  ) {}

  async listSessions(
    pagination?: { page?: number; limit?: number },
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where: { tenantId },
        orderBy: { openedAt: 'desc' },
        skip,
        take: limit,
        include: { movements: { orderBy: { createdAt: 'desc' }, take: 50 } },
      }),
      this.prisma.cashSession.count({ where: { tenantId } }),
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

  async getSession(id: string, tenantId?: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const s = await this.prisma.cashSession.findFirst({
      where: { id, tenantId },
    });
    if (!s) throw new NotFoundException('Caja no encontrada.');
    return s;
  }

  async openSession(
    openingAmount: number,
    openedBy?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const startTime = Date.now();
    this.logger.log(`Abriendo sesión de caja`, {
      openingAmount,
      userId: openedBy,
    });

    // Validar límites de monto
    this.limits.validateCashAmount(openingAmount, 'opening');

    const session = await this.prisma.cashSession.create({
      data: {
        tenantId,
        openingAmount,
        openedBy: openedBy ?? null,
      },
    });
    const duration = Date.now() - startTime;

    this.logger.log(
      `Sesión de caja ${session.id} abierta exitosamente (${duration}ms)`,
      {
        sessionId: session.id,
        openingAmount: Number(openingAmount),
        duration,
        userId: openedBy,
      },
    );

    await this.audit.logCreate('cashSession', session.id, openedBy, {
      openingAmount: Number(openingAmount),
    });

    return session;
  }

  async closeSession(
    id: string,
    closingAmount: number,
    closedBy?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const startTime = Date.now();
    this.logger.log(`Cerrando sesión de caja ${id}`, {
      sessionId: id,
      closingAmount,
      userId: closedBy,
    });

    const session = await this.getSession(id, tenantId);

    // Validar que la sesión no esté ya cerrada
    if (session.closedAt) {
      this.logger.warn(`Intento de cerrar sesión ${id} ya cerrada`, {
        sessionId: id,
        closedAt: session.closedAt,
      });
      throw new BadRequestException(`La sesión de caja ${id} ya está cerrada.`);
    }

    // Validar que no haya ventas pendientes
    const pendingSales = await this.prisma.sale.count({
      where: {
        cashMovements: {
          some: {
            sessionId: id,
          },
        },
        status: {
          not: 'PAID',
        },
      },
    });

    if (pendingSales > 0) {
      this.logger.warn(
        `Intento de cerrar sesión ${id} con ${pendingSales} ventas pendientes`,
        {
          sessionId: id,
          pendingSales,
        },
      );
      throw new BadRequestException(
        `No se puede cerrar la sesión. Hay ${pendingSales} venta(s) pendiente(s).`,
      );
    }

    // Validar límites de monto
    this.limits.validateCashAmount(closingAmount, 'movement');

    const updated = await this.prisma.cashSession.update({
      where: { id },
      data: {
        closedAt: new Date(),
        closingAmount,
      },
    });
    const duration = Date.now() - startTime;

    this.logger.log(
      `Sesión de caja ${id} cerrada exitosamente (${duration}ms)`,
      {
        sessionId: id,
        closingAmount: Number(closingAmount),
        duration,
        userId: closedBy,
      },
    );

    await this.audit.logUpdate(
      'cashSession',
      id,
      closedBy,
      {
        closedAt: null,
        closingAmount: null,
      },
      {
        closedAt: updated.closedAt,
        closingAmount: Number(closingAmount),
      },
    );

    return updated;
  }

  async listMovements(
    sessionId: string,
    pagination?: { page?: number; limit?: number },
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const session = await this.getSession(sessionId, tenantId);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          relatedExpense: {
            select: { id: true, description: true, amount: true },
          },
        },
      }),
      this.prisma.cashMovement.count({ where: { sessionId } }),
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

  async listAllMovements(
    params: {
      page?: number;
      limit?: number;
      sessionId?: string;
      type?: 'IN' | 'OUT' | 'ADJUST';
      startDate?: string;
      endDate?: string;
    },
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: {
      session?: { tenantId: string };
      sessionId?: string;
      type?: 'IN' | 'OUT' | 'ADJUST';
      createdAt?: { gte?: Date; lte?: Date };
    } = { session: { tenantId } };

    if (params.sessionId) where.sessionId = params.sessionId;
    if (params.type) where.type = params.type;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          session: {
            select: { id: true, openedAt: true, closedAt: true },
          },
        },
      }),
      this.prisma.cashMovement.count({ where }),
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

  async createMovement(
    sessionId: string,
    dto: {
      type: 'IN' | 'OUT' | 'ADJUST';
      method: string;
      amount: number;
      reference?: string;
    },
    createdBy?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException('Caja no encontrada.');
    if (session.closedAt) {
      throw new BadRequestException(
        'No se pueden agregar movimientos a una sesión de caja cerrada.',
      );
    }

    this.limits.validateCashAmount(dto.amount, 'movement');

    const movement = await this.prisma.cashMovement.create({
      data: {
        sessionId,
        // ADJUST en enum tras prisma generate; cast para compilar con cliente antiguo
        type: dto.type as any,
        method: dto.method as 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER',
        amount: dto.amount,
        reference: dto.reference ?? null,
      },
    });

    this.logger.log(`Movimiento de caja creado`, {
      movementId: movement.id,
      sessionId,
      type: dto.type,
      amount: dto.amount,
      userId: createdBy,
    });

    await this.audit.logCreate('cashMovement', movement.id, createdBy, {
      sessionId,
      type: dto.type,
      amount: dto.amount,
    });

    return movement;
  }
}
