import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ListUsageOptions = {
  tenantId?: string;
  event?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista eventos de uso (solo para admin de plataforma). Incluye nombre del tenant para mostrar.
   */
  async list(options: ListUsageOptions) {
    const limit = Math.min(options.limit ?? 50, 200);
    const offset = options.offset ?? 0;
    const where: Prisma.UsageEventWhereInput = {};
    if (options.tenantId) where.tenantId = options.tenantId;
    if (options.event) where.event = options.event;
    if (options.from || options.to) {
      where.createdAt = {};
      if (options.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(options.from);
      if (options.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(options.to);
    }
    const [items, total] = await Promise.all([
      this.prisma.usageEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          event: true,
          payload: true,
          createdAt: true,
          tenantId: true,
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.usageEvent.count({ where }),
    ]);
    return { items, total, limit, offset };
  }

  /**
   * Registra un evento de uso para mejorar el producto (solo uso interno).
   * tenantId y userId se toman del JWT; no se almacenan PII en payload.
   */
  async record(
    event: string,
    options: {
      tenantId?: string | null;
      userId?: string | null;
      payload?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.prisma.usageEvent.create({
      data: {
        event: event.slice(0, 120),
        tenantId: options.tenantId ?? undefined,
        userId: options.userId ?? undefined,
        payload: (options.payload ?? undefined) as Prisma.InputJsonValue,
      },
    });
  }
}
