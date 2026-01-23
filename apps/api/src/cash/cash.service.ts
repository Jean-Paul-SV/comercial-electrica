import { Injectable, NotFoundException } from '@nestjs/common';
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
    await this.getSession(id);
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

