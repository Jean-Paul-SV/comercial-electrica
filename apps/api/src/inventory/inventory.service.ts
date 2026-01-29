import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: ValidationLimitsService,
    private readonly audit: AuditService,
  ) {}

  async createMovement(dto: CreateMovementDto, createdByUserId?: string) {
    const startTime = Date.now();
    this.logger.log(`Creando movimiento de inventario tipo ${dto.type}`, {
      type: dto.type,
      itemsCount: dto.items?.length ?? 0,
      userId: createdByUserId,
    });

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debe incluir items.');
    }

    // Validar que supplierId solo se use en movimientos IN
    if (dto.supplierId && dto.type !== InventoryMovementType.IN) {
      throw new BadRequestException(
        'El proveedor solo puede especificarse en movimientos de entrada (IN).',
      );
    }

    // Validar que el proveedor existe si se proporciona
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier) {
        throw new BadRequestException(
          `Proveedor con ID ${dto.supplierId} no encontrado.`,
        );
      }
      if (!supplier.isActive) {
        throw new BadRequestException(
          `El proveedor ${supplier.name} está inactivo.`,
        );
      }
    }

    // Validar límites de cantidad
    for (const item of dto.items) {
      this.limits.validateInventoryQty(item.qty, dto.type);
    }

    // Validar que todos los productos existen antes de iniciar la transacción
    const productIds = dto.items.map((it) => it.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missingIds = productIds.filter((id) => !foundIds.includes(id));
      this.logger.warn(`Productos no encontrados: ${missingIds.join(', ')}`, {
        missingIds,
        requestedIds: productIds,
      });
      throw new BadRequestException(
        `Uno o más productos no existen: ${missingIds.join(', ')}`,
      );
    }

    const type = dto.type;
    const sign =
      type === InventoryMovementType.IN
        ? 1
        : type === InventoryMovementType.OUT
          ? -1
          : 1;

    return this.prisma
      .$transaction(
        async (tx) => {
          const movement = await tx.inventoryMovement.create({
            data: {
              type,
              reason: dto.reason,
              supplierId: dto.supplierId,
              createdBy: createdByUserId,
              items: {
                create: dto.items.map((it) => ({
                  productId: it.productId,
                  qty: it.qty,
                  unitCost: it.unitCost,
                })),
              },
            },
            include: { items: true, supplier: true },
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
      )
      .then(async (movement) => {
        // Audit logging (después de la transacción)
        await this.audit.logCreate(
          'inventoryMovement',
          movement.id,
          createdByUserId,
          {
            type: dto.type,
            reason: dto.reason,
            itemsCount: dto.items.length,
          },
        );

        return movement;
      });
  }

  async listMovements(pagination?: { page?: number; limit?: number }) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        orderBy: { createdAt: 'desc' },
        include: { items: true, supplier: true },
        skip,
        take: limit,
      }),
      this.prisma.inventoryMovement.count(),
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
}
