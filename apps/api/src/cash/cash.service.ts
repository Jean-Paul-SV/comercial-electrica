import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  listSessions() {
    return this.prisma.cashSession.findMany({
      orderBy: { openedAt: 'desc' },
      take: 100,
      include: { movements: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
  }

  async getSession(id: string) {
    const s = await this.prisma.cashSession.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Caja no encontrada.');
    return s;
  }

  openSession(openingAmount: number, openedBy?: string) {
    return this.prisma.cashSession.create({
      data: {
        openingAmount,
        openedBy: openedBy ?? null,
      },
    });
  }

  async closeSession(id: string, closingAmount: number) {
    const session = await this.getSession(id);

    // Validar que la sesión no esté ya cerrada
    if (session.closedAt) {
      throw new BadRequestException(`La sesión de caja ${id} ya está cerrada.`);
    }

    // Validar que no haya ventas pendientes (opcional según reglas de negocio)
    // Por ahora solo validamos que la sesión esté abierta

    return this.prisma.cashSession.update({
      where: { id },
      data: {
        closedAt: new Date(),
        closingAmount,
      },
    });
  }

  listMovements(sessionId: string) {
    return this.prisma.cashMovement.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}

