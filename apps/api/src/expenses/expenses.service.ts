import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: ValidationLimitsService,
    private readonly audit: AuditService,
  ) {}

  /** Delegate Expense (cliente Prisma: ejecutar `npx prisma generate` en apps/api para tipos completos). */
  private get expenseDelegate() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any).expense;
  }

  async create(dto: CreateExpenseDto, createdBy?: string) {
    this.limits.validateCashAmount(Number(dto.amount), 'movement');

    const expenseDate = dto.expenseDate
      ? new Date(dto.expenseDate)
      : new Date();

    if (dto.cashSessionId) {
      const session = await this.prisma.cashSession.findUnique({
        where: { id: dto.cashSessionId },
      });
      if (!session) throw new NotFoundException('Sesión de caja no encontrada.');
      if (session.closedAt) {
        throw new BadRequestException(
          'No se puede registrar el gasto en una sesión de caja cerrada.',
        );
      }
    }

    const expense = await this.expenseDelegate.create({
      data: {
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
  ) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: { expenseDate?: { gte?: Date; lte?: Date }; category?: string } = {};

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
    if (dto.category?.trim()) {
      where.category = dto.category.trim();
    }

    const [data, total] = await Promise.all([
      this.expenseDelegate.findMany({
        where,
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
        include: { cashSession: true },
      }),
      this.expenseDelegate.count({ where }),
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

  async getById(id: string) {
    const expense = await this.expenseDelegate.findUnique({
      where: { id },
      include: { cashSession: true },
    });
    if (!expense) throw new NotFoundException('Gasto no encontrado.');
    return expense;
  }

  async remove(id: string, deletedByUserId?: string, deletionReason?: string) {
    const expense = await this.expenseDelegate.findUnique({
      where: { id },
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
      await (tx as unknown as { expense: { delete: (args: { where: { id: string } }) => Promise<unknown> } }).expense.delete({
        where: { id },
      });
    });

    this.logger.log(`Gasto eliminado`, { expenseId: id, userId: deletedByUserId });
    await this.audit.logDelete('expense', id, deletedByUserId, {
      amount: Number(expense.amount),
      description: expense.description,
      deletionReason: deletionReason ?? undefined,
    });
    return { id };
  }
}
