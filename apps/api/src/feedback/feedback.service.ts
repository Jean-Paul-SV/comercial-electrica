import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedbackStatus } from '@prisma/client';

const DIAN_MODULE_CODE = 'electronic_invoicing';

/** Detecta si el mensaje es una solicitud de activación de facturación electrónica DIAN. */
function isDianActivationMessage(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return (
    (lower.includes('solicitud') && lower.includes('activación') && lower.includes('facturación')) ||
    (lower.includes('activación') && lower.includes('factura electrónica'))
  );
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una sugerencia de mejora enviada por un usuario de un tenant.
   * Si el mensaje es una solicitud de activación DIAN, asegura DianConfig PENDING para que aparezca en Solicitudes DIAN.
   */
  async create(tenantId: string, userId: string, message: string) {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new BadRequestException('El mensaje no puede estar vacío.');
    }
    const created = await this.prisma.tenantFeedback.create({
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

    if (isDianActivationMessage(trimmed)) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          plan: {
            select: {
              features: { select: { moduleCode: true } },
            },
          },
        },
      });
      const hasDianPlan =
        tenant?.plan?.features.some((f) => f.moduleCode === DIAN_MODULE_CODE) ?? false;
      if (hasDianPlan) {
        await this.prisma.dianConfig.upsert({
          where: { tenantId },
          create: { tenantId, activationStatus: 'PENDING' },
          update: { activationStatus: 'PENDING' },
        });
      }
    }

    return created;
  }

  /**
   * Lista todas las sugerencias (para panel proveedor). Opcional filtro por tenantId y status.
   * Si excludeDianRequests es true, no se incluyen mensajes que son solicitudes de activación DIAN (esas se gestionan en Solicitudes DIAN).
   */
  async findAll(
    tenantId?: string,
    status?: FeedbackStatus,
    excludeDianRequests = false,
  ) {
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

    const filtered = excludeDianRequests
      ? items.filter((f) => !isDianActivationMessage(f.message))
      : items;

    return filtered.map((f) => ({
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
