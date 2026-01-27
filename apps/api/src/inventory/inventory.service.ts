import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createMovement(dto: CreateMovementDto, createdByUserId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debe incluir items.');
    }

    // Validar que todos los productos existen antes de iniciar la transacción
    const productIds = dto.items.map((it) => it.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missingIds = productIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Uno o más productos no existen: ${missingIds.join(', ')}`,
      );
    }

    const type = dto.type;
    const sign = type === InventoryMovementType.IN ? 1 : type === InventoryMovementType.OUT ? -1 : 1;

    return this.prisma.$transaction(
      async (tx) => {
        const movement = await tx.inventoryMovement.create({
          data: {
            type,
            reason: dto.reason,
            createdBy: createdByUserId,
            items: {
              create: dto.items.map((it) => ({
                productId: it.productId,
                qty: it.qty,
                unitCost: it.unitCost,
              })),
            },
          },
          include: { items: true },
        });

        for (const it of dto.items) {
          const delta = sign * it.qty;

          // Ensure balance row exists
          const current = await tx.stockBalance.upsert({
            where: { productId: it.productId },
            create: { productId: it.productId, qtyOnHand: 0, qtyReserved: 0 },
            update: {},
          });

          const next = current.qtyOnHand + delta;
          if (next < 0) {
            throw new BadRequestException(
              `Stock insuficiente para productId=${it.productId}. Disponible=${current.qtyOnHand}, requerido=${Math.abs(delta)}.`,
            );
          }

          await tx.stockBalance.update({
            where: { productId: it.productId },
            data: { qtyOnHand: next },
          });
        }

        return movement;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  listMovements() {
    return this.prisma.inventoryMovement.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true },
      take: 200,
    });
  }
}

