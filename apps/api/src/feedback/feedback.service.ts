import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedbackStatus } from '@prisma/client';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una sugerencia de mejora enviada por un usuario de un tenant.
   */
  async create(tenantId: string, userId: string, message: string) {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new BadRequestException('El mensaje no puede estar vacío.');
    }
    return this.prisma.tenantFeedback.create({
      data: {
        tenantId,
        userId,
        message: trimmed,
        status: 'PENDING',
      },
      select: {
        id: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Lista todas las sugerencias (para panel proveedor). Opcional filtro por tenantId y status.
   */
  async findAll(tenantId?: string, status?: FeedbackStatus) {
    const where: { tenantId?: string; status?: FeedbackStatus } = {};
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;

    const items = await this.prisma.tenantFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return items.map((f) => ({
      id: f.id,
      message: f.message,
      status: f.status,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      tenant: f.tenant,
      user: f.user,
    }));
  }

  /**
   * Lista las sugerencias del tenant del usuario (para que vea las que él envió).
   */
  async findMy(tenantId: string, userId: string) {
    return this.prisma.tenantFeedback.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Actualiza el estado de una sugerencia (solo panel proveedor).
   */
  async updateStatus(id: string, status: FeedbackStatus) {
    const existing = await this.prisma.tenantFeedback.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Sugerencia no encontrada.');
    }
    return this.prisma.tenantFeedback.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });
  }
}
