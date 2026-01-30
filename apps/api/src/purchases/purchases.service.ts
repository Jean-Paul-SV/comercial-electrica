import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus, InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';
import { CacheService } from '../common/services/cache.service';
import { createPaginatedResponse } from '../common/interfaces/pagination.interface';

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: ValidationLimitsService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    createdByUserId?: string,
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debe incluir items.');
    }

    // Validar límites
    this.limits.validateItemsCount(dto.items.length, 'purchase');
    for (const item of dto.items) {
      this.limits.validateItemQty(item.qty);
    }

    // Validar que el proveedor existe y está activo
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(
        `Proveedor con id ${dto.supplierId} no encontrado.`,
      );
    }
    if (!supplier.isActive) {
      throw new BadRequestException('El proveedor está inactivo.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Validar que los productos existan
        const products = await tx.product.findMany({
          where: { id: { in: dto.items.map((i) => i.productId) } },
        });

        if (products.length !== dto.items.length) {
          throw new BadRequestException('Uno o más productos no existen.');
        }

        // Calcular totales
        let subtotal = 0;
        let taxTotal = 0;
        const orderItems = dto.items.map((i) => {
          const p = products.find((pp) => pp.id === i.productId)!;
          const unitCost = i.unitCost;
          const lineSubtotal = unitCost * i.qty;
          const lineTax = (lineSubtotal * Number(p.taxRate ?? 0)) / 100;
          const lineTotal = lineSubtotal + lineTax;
          subtotal += lineSubtotal;
          taxTotal += lineTax;
          return {
            productId: p.id,
            qty: i.qty,
            unitCost,
            taxRate: Number(p.taxRate ?? 0),
            lineTotal,
            receivedQty: 0,
          };
        });

        const grandTotal = subtotal + taxTotal;

        // Generar número de pedido único
        const orderNumber = await this.generateOrderNumber(tx);

        // Crear pedido
        const purchaseOrder = await tx.purchaseOrder.create({
          data: {
            supplierId: dto.supplierId,
            orderNumber,
            status: PurchaseOrderStatus.DRAFT,
            orderDate: new Date(),
            expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
            notes: dto.notes,
            subtotal,
            taxTotal,
            discountTotal: 0,
            grandTotal,
            createdBy: createdByUserId,
            items: {
              create: orderItems,
            },
          },
          include: {
            supplier: true,
            items: { include: { product: true } },
          },
        });

        this.logger.log(
          `Pedido de compra ${purchaseOrder.id} creado exitosamente`,
          {
            orderNumber: purchaseOrder.orderNumber,
            supplierId: dto.supplierId,
            itemsCount: dto.items.length,
            userId: createdByUserId,
          },
        );

        await this.audit.logCreate(
          'purchaseOrder',
          purchaseOrder.id,
          createdByUserId,
          {
            orderNumber: purchaseOrder.orderNumber,
            supplierId: dto.supplierId,
            itemsCount: dto.items.length,
            grandTotal: Number(grandTotal),
          },
        );

        return purchaseOrder;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).then(async (purchaseOrder) => {
      await this.cache.deletePattern('cache:purchaseOrders:*');
      return purchaseOrder;
    });
  }

  async listPurchaseOrders(pagination?: { page?: number; limit?: number }) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        orderBy: { orderDate: 'desc' },
        include: {
          supplier: true,
          items: { include: { product: true } },
        },
        skip,
        take: limit,
      }),
      this.prisma.purchaseOrder.count(),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async getPurchaseOrder(id: string) {
    const cacheKey = this.cache.buildKey('purchaseOrder', id);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`PurchaseOrder ${id} retrieved from cache`);
      return cached;
    }

    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: true } },
        invoices: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido de compra no encontrado.');
    }

    await this.cache.set(cacheKey, order, 300);
    return order;
  }

  async receivePurchaseOrder(
    id: string,
    dto: ReceivePurchaseOrderDto,
    receivedByUserId?: string,
  ) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        supplier: true,
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Pedido de compra no encontrado.');
    }

    if (purchaseOrder.status === PurchaseOrderStatus.COMPLETED) {
      throw new BadRequestException('El pedido ya fue completado.');
    }

    if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede recibir un pedido cancelado.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const receivedDate = dto.receivedDate
          ? new Date(dto.receivedDate)
          : new Date();

        // Validar y actualizar items recibidos
        const inventoryItems: Array<{
          productId: string;
          qty: number;
          unitCost: number;
        }> = [];

        for (const receivedItem of dto.items) {
          const orderItem = purchaseOrder.items.find(
            (item) => item.id === receivedItem.itemId,
          );

          if (!orderItem) {
            throw new NotFoundException(
              `Item ${receivedItem.itemId} no encontrado en el pedido.`,
            );
          }

          const totalReceived = orderItem.receivedQty + receivedItem.receivedQty;
          if (totalReceived > orderItem.qty) {
            throw new BadRequestException(
              `Cantidad recibida excede lo pedido para item ${orderItem.id}. Pedido: ${orderItem.qty}, Ya recibido: ${orderItem.receivedQty}, Intenta recibir: ${receivedItem.receivedQty}`,
            );
          }

          // Actualizar cantidad recibida del item
          await tx.purchaseOrderItem.update({
            where: { id: receivedItem.itemId },
            data: { receivedQty: totalReceived },
          });

          // Agregar a items de inventario
          inventoryItems.push({
            productId: orderItem.productId,
            qty: receivedItem.receivedQty,
            unitCost: Number(orderItem.unitCost),
          });
        }

        // Determinar nuevo estado del pedido
        const allItemsReceived = purchaseOrder.items.every(
          (item) =>
            item.receivedQty +
              (dto.items.find((ri) => ri.itemId === item.id)?.receivedQty ??
                0) >=
            item.qty,
        );

        const someItemsReceived = purchaseOrder.items.some(
          (item) =>
            item.receivedQty +
              (dto.items.find((ri) => ri.itemId === item.id)?.receivedQty ??
                0) >
            0,
        );

        let newStatus = purchaseOrder.status;
        if (allItemsReceived) {
          newStatus = PurchaseOrderStatus.COMPLETED;
        } else if (someItemsReceived) {
          newStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;
        } else {
          newStatus = PurchaseOrderStatus.RECEIVED;
        }

        // Actualizar pedido
        const updatedOrder = await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: newStatus,
            receivedDate: receivedDate,
          },
          include: {
            supplier: true,
            items: { include: { product: true } },
          },
        });

        // Crear movimiento de inventario automático
        if (inventoryItems.length > 0) {
          const movement = await tx.inventoryMovement.create({
            data: {
              type: InventoryMovementType.IN,
              reason: `Recepción de pedido ${purchaseOrder.orderNumber}`,
              supplierId: purchaseOrder.supplierId,
              createdBy: receivedByUserId,
              items: {
                create: inventoryItems.map((it) => ({
                  productId: it.productId,
                  qty: it.qty,
                  unitCost: it.unitCost,
                })),
              },
            },
            include: { items: true },
          });

          // Actualizar stock
          for (const it of inventoryItems) {
            const current = await tx.stockBalance.upsert({
              where: { productId: it.productId },
              create: { productId: it.productId, qtyOnHand: 0, qtyReserved: 0 },
              update: {},
            });

            await tx.stockBalance.update({
              where: { productId: it.productId },
              data: { qtyOnHand: current.qtyOnHand + it.qty },
            });
          }

          this.logger.log(
            `Movimiento de inventario ${movement.id} creado automáticamente para pedido ${purchaseOrder.orderNumber}`,
          );
        }

        await this.audit.logUpdate(
          'purchaseOrder',
          id,
          receivedByUserId,
          {
            status: purchaseOrder.status,
            receivedDate: purchaseOrder.receivedDate,
          },
          {
            status: newStatus,
            receivedDate: receivedDate,
          },
        );

        return updatedOrder;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).then(async (updatedOrder) => {
      await this.cache.delete(this.cache.buildKey('purchaseOrder', id));
      await this.cache.deletePattern('cache:purchaseOrders:*');
      return updatedOrder;
    });
  }

  private async generateOrderNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    // Buscar el último número del mes
    const lastOrder = await tx.purchaseOrder.findFirst({
      where: {
        orderNumber: {
          startsWith: `PO-${year}${month}`,
        },
      },
      orderBy: { orderNumber: 'desc' },
    });

    let sequence = 1;
    if (lastOrder) {
      const match = lastOrder.orderNumber.match(/\d+$/);
      if (match) {
        sequence = parseInt(match[0], 10) + 1;
      }
    }

    return `PO-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }
}
