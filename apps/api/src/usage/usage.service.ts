import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

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
