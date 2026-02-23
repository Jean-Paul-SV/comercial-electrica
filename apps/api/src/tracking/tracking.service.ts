import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una visita a una página. tenantId y userId pueden ser null (ej. admin en panel proveedor).
   */
  async recordVisit(options: {
    tenantId: string | null;
    userId: string | null;
    path: string;
  }): Promise<void> {
    const path = options.path.slice(0, 500);
    await this.prisma.pageVisit.create({
      data: {
        tenantId: options.tenantId ?? undefined,
        userId: options.userId ?? undefined,
        path,
      },
    });
  }
}
