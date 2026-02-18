import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';
import { TenantContextService } from '../common/services/tenant-context.service';
import { buildPaginationMeta } from '../common/utils/pagination';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: ValidationLimitsService,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Delegate Expense (cliente Prisma: ejecutar `npx prisma generate` en apps/api para tipos completos). */
  private get expenseDelegate() {
    return (this.prisma as any).expense;
  }

  async create(
    dto: CreateExpenseDto,
    createdBy?: string,
    tenantId?: string | null,
  ) {
    const currentTenantId = this.tenantContext.ensureTenant(tenantId);
    this.limits.validateCashAmount(Number(dto.amount), 'movement');

    const expenseDate = dto.expenseDate
      ? new Date(dto.expenseDate)
      : new Date();

    // Validación de negocio: la fecha del gasto no puede ser futura
    const now = new Date();
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    if (expenseDate > todayEnd) {
      throw new BadRequestException('La fecha del gasto no puede ser futura.');
    }

    if (dto.cashSessionId) {
      const session = await this.prisma.cashSession.findFirst({
        where: { id: dto.cashSessionId, tenantId: currentTenantId },
      });
      if (!session)
        throw new NotFoundException('Sesión de caja no encontrada.');
      if (session.closedAt) {
        throw new BadRequestException(
          'No se puede registrar el gasto en una sesión de caja cerrada.',
        );
      }
    }

    const expense = await this.expenseDelegate.create({
      data: {
        tenantId: currentTenantId,
        amount: dto.amount,
        description: dto.description.trim(),
        category: dto.category?.trim() ?? null,
        expenseDate,
        paymentMethod: dto.paymentMethod,
        cashSessionId: dto.cashSessionId ?? null,
        reference: dto.reference?.trim() ?? null,
        createdBy: createdBy ?? null,
      },
    });

    if (dto.cashSessionId) {
      await this.prisma.cashMovement.create({
        data: {
          sessionId: dto.cashSessionId,
          type: 'OUT',
          method: dto.paymentMethod,
          amount: dto.amount,
          reference: `Gasto: ${dto.description.trim().slice(0, 80)}`,
          relatedExpenseId: expense.id,
        },
      });
    }

    this.logger.log(`Gasto creado`, {
      expenseId: expense.id,
      amount: Number(dto.amount),
      cashSessionId: dto.cashSessionId,
      userId: createdBy,
    });

    await this.audit.logCreate('expense', expense.id, createdBy, {
      amount: Number(dto.amount),
      description: dto.description,
    });

    return expense;
  }

  async list(
    dto: ListExpensesDto,
    pagination?: { page?: number; limit?: number },
    tenantId?: string | null,
  ) {
    const currentTenantId = this.tenantContext.ensureTenant(tenantId);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const CATEGORY_FACTURA_PROVEEDOR = 'Factura proveedor';
    const CATEGORY_PEDIDO_DE_COMPRA = 'Pedido de compra';
    const search = dto.search?.trim();
    type Where = {
      tenantId: string;
      cashSessionId?: string;
      expenseDate?: { gte?: Date; lte?: Date };
      category?: string;
      kind?: 'FIXED' | 'VARIABLE' | 'OTHER';
      OR?: Array<
        | { category: string | null }
        | { category: { not: string } }
        | { category: { in: string[] } }
        | { category: { notIn: string[] } }
      >;
      AND?: unknown[];
    };
    const where: Where = { tenantId: currentTenantId };

    if (dto.cashSessionId?.trim()) {
      where.cashSessionId = dto.cashSessionId.trim();
    }
    if (dto.startDate || dto.endDate) {
      where.expenseDate = {};
      if (dto.startDate) {
        where.expenseDate.gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        const end = new Date(dto.endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }
    if (dto.expenseType === 'compras') {
      where.OR = [
        { category: CATEGORY_FACTURA_PROVEEDOR },
        { category: CATEGORY_PEDIDO_DE_COMPRA },
      ];
    } else if (dto.expenseType === 'otros') {
      where.OR = [
        { category: null },
        {
          category: {
            notIn: [CATEGORY_FACTURA_PROVEEDOR, CATEGORY_PEDIDO_DE_COMPRA],
          },
        },
      ];
    } else if (dto.category?.trim() && !search) {
      where.category = dto.category.trim();
    }
    if (search) {
      where.AND = [
        {
          OR: [
            { description: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.expenseDelegate.findMany({
        where,
        // Orden de llegada: más recientes primero
        // (si varios tienen misma fecha de gasto, el desempate lo hace createdAt/id)
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        include: { cashSession: true },
      }),
      this.expenseDelegate.count({ where }),
    ]);

    return {
      data,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getById(id: string, tenantId?: string | null) {
    const currentTenantId = this.tenantContext.ensureTenant(tenantId);
    const expense = await this.expenseDelegate.findFirst({
      where: { id, tenantId: currentTenantId },
      include: { cashSession: true },
    });
    if (!expense) throw new NotFoundException('Gasto no encontrado.');
    return expense;
  }

  async remove(
    id: string,
    deletedByUserId?: string,
    deletionReason?: string,
    tenantId?: string | null,
  ) {
    const currentTenantId = this.tenantContext.ensureTenant(tenantId);
    const expense = await this.expenseDelegate.findFirst({
      where: { id, tenantId: currentTenantId },
      include: { cashSession: true },
    });
    if (!expense) throw new NotFoundException('Gasto no encontrado.');

    await this.prisma.$transaction(async (tx) => {
      let movement = await tx.cashMovement.findFirst({
        where: { relatedExpenseId: id },
      });
      if (!movement && expense.cashSessionId) {
        const refPrefix = `Gasto: ${expense.description.trim().slice(0, 80)}`;
        movement = await tx.cashMovement.findFirst({
          where: {
            sessionId: expense.cashSessionId,
            type: 'OUT',
            amount: expense.amount,
            reference: { startsWith: 'Gasto:' },
          },
        });
      }
      if (movement) {
        await tx.cashMovement.delete({ where: { id: movement.id } });
      }
      await (
        tx as unknown as {
          expense: {
            delete: (args: { where: { id: string } }) => Promise<unknown>;
          };
        }
      ).expense.delete({
        where: { id },
      });
    });

    this.logger.log(`Gasto eliminado`, {
      expenseId: id,
      userId: deletedByUserId,
    });
    await this.audit.logDelete('expense', id, deletedByUserId, {
      amount: Number(expense.amount),
      description: expense.description,
      deletionReason: deletionReason ?? undefined,
    });
    return { id };
  }
}
