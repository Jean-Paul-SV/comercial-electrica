import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, SupplierInvoiceStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AuditService } from '../common/services/audit.service';
import { CacheService } from '../common/services/cache.service';
import { createPaginatedResponse } from '../common/interfaces/pagination.interface';

@Injectable()
export class SupplierInvoicesService {
  private readonly logger = new Logger(SupplierInvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  async createSupplierInvoice(
    dto: CreateSupplierInvoiceDto,
    createdByUserId?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    // Validar que el proveedor existe, está activo y pertenece al tenant
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException(
        `Proveedor con id ${dto.supplierId} no encontrado.`,
      );
    }
    if (!supplier.isActive) {
      throw new BadRequestException('El proveedor está inactivo.');
    }

    // Validar que el pedido existe si se proporciona
    if (dto.purchaseOrderId) {
      const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
        where: { id: dto.purchaseOrderId },
      });
      if (!purchaseOrder) {
        throw new NotFoundException(
          `Pedido de compra con id ${dto.purchaseOrderId} no encontrado.`,
        );
      }
    }

    // Validar fechas
    const invoiceDate = new Date(dto.invoiceDate);
    const dueDate = new Date(dto.dueDate);
    if (dueDate <= invoiceDate) {
      throw new BadRequestException(
        'La fecha de vencimiento debe ser posterior a la fecha de la factura.',
      );
    }

    // Calcular desde porcentajes: descuento sobre subtotal, impuesto sobre (subtotal - descuento)
    const discountRate = dto.discountRate ?? 0;
    const discountTotal =
      Math.round(dto.subtotal * (discountRate / 100) * 100) / 100;
    const baseAfterDiscount = dto.subtotal - discountTotal;
    const taxTotal =
      Math.round(baseAfterDiscount * (dto.taxRate / 100) * 100) / 100;
    const grandTotal = Math.round((baseAfterDiscount + taxTotal) * 100) / 100;

    const abono = dto.abono ?? 0;
    if (abono > grandTotal) {
      throw new BadRequestException(
        `El abono no puede ser mayor al total de la factura (${grandTotal}).`,
      );
    }
    if (abono > 0 && !dto.abonoPaymentMethod) {
      throw new BadRequestException('Indica el método de pago del abono.');
    }

    return this.prisma
      .$transaction(
        async (tx) => {
          // Verificar que el número de factura no existe en este tenant
          const existing = await tx.supplierInvoice.findFirst({
            where: { tenantId, invoiceNumber: dto.invoiceNumber },
          });
          if (existing) {
            throw new BadRequestException(
              `Ya existe una factura con número ${dto.invoiceNumber}.`,
            );
          }

          // Determinar estado inicial basado en fecha de vencimiento y abono
          let status: SupplierInvoiceStatus = SupplierInvoiceStatus.PENDING;
          if (dueDate < new Date()) {
            status = SupplierInvoiceStatus.OVERDUE;
          }
          const paidAmount = abono;
          if (paidAmount >= grandTotal) {
            status = SupplierInvoiceStatus.PAID;
          } else if (paidAmount > 0) {
            status = SupplierInvoiceStatus.PARTIALLY_PAID;
          }

          const invoice = await tx.supplierInvoice.create({
            data: {
              tenantId,
              supplierId: dto.supplierId,
              purchaseOrderId: dto.purchaseOrderId,
              invoiceNumber: dto.invoiceNumber,
              invoiceDate: invoiceDate,
              dueDate: dueDate,
              status,
              subtotal: dto.subtotal,
              taxTotal,
              discountTotal,
              grandTotal,
              paidAmount,
              notes: dto.notes,
            },
            include: {
              supplier: true,
              purchaseOrder: true,
            },
          });

          if (abono > 0 && dto.abonoPaymentMethod) {
            const paymentDate = new Date();
            await tx.supplierPayment.create({
              data: {
                supplierInvoiceId: invoice.id,
                amount: abono,
                paymentDate,
                paymentMethod: dto.abonoPaymentMethod,
                reference: 'Abono inicial',
                notes: dto.notes,
                createdBy: createdByUserId,
              },
            });
            await this.audit.logCreate(
              'supplierPayment',
              invoice.id,
              createdByUserId,
              {
                invoiceId: invoice.id,
                amount: abono,
                paymentMethod: dto.abonoPaymentMethod,
              },
            );
            // Registrar el abono como gasto
            const supplierName = invoice.supplier?.name ?? 'Proveedor';
            const expenseDescription =
              `Factura proveedor ${supplierName} - #${invoice.invoiceNumber} (abono)`.slice(
                0,
                255,
              );
            const expenseDelegate = (
              tx as {
                expense?: {
                  create: (args: unknown) => Promise<{ id: string }>;
                };
              }
            ).expense;
            if (expenseDelegate) {
              await expenseDelegate.create({
                data: {
                  tenantId,
                  amount: abono,
                  description: expenseDescription,
                  category: 'Factura proveedor',
                  expenseDate: paymentDate,
                  paymentMethod: dto.abonoPaymentMethod,
                  cashSessionId: null,
                  reference: 'Abono inicial',
                  createdBy: createdByUserId ?? null,
                },
              });
            }
          }

          this.logger.log(
            `Factura de proveedor ${invoice.id} creada exitosamente`,
            {
              invoiceNumber: invoice.invoiceNumber,
              supplierId: dto.supplierId,
              dueDate: dueDate.toISOString(),
              grandTotal: Number(grandTotal),
              paidAmount: abono,
              userId: createdByUserId,
            },
          );

          await this.audit.logCreate(
            'supplierInvoice',
            invoice.id,
            createdByUserId,
            {
              invoiceNumber: invoice.invoiceNumber,
              supplierId: dto.supplierId,
              dueDate: dueDate.toISOString(),
              grandTotal: Number(grandTotal),
              taxRate: dto.taxRate,
              discountRate: discountRate,
            },
          );

          return invoice;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .then(async (invoice) => {
        await this.cache.deletePattern('cache:supplierInvoices:*');
        return invoice;
      });
  }

  async listSupplierInvoices(
    pagination?: {
      page?: number;
      limit?: number;
      status?: SupplierInvoiceStatus;
      supplierId?: string;
      search?: string;
    },
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const page = Math.max(1, Number(pagination?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(pagination?.limit) || 20));
    const skip = (page - 1) * limit;
    const searchTrim =
      typeof pagination?.search === 'string' ? pagination.search.trim() : '';

    const where: Prisma.SupplierInvoiceWhereInput = { tenantId };
    const validStatuses = Object.values(SupplierInvoiceStatus);
    if (
      pagination?.status &&
      typeof pagination.status === 'string' &&
      validStatuses.includes(pagination.status)
    ) {
      where.status = pagination.status;
    }
    if (pagination?.supplierId && typeof pagination.supplierId === 'string') {
      where.supplierId = pagination.supplierId;
    }
    if (searchTrim.length > 0) {
      where.AND = [
        {
          OR: [
            { invoiceNumber: { contains: searchTrim, mode: 'insensitive' } },
            {
              supplier: { name: { contains: searchTrim, mode: 'insensitive' } },
            },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.supplierInvoice.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        include: {
          supplier: true,
          purchaseOrder: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.supplierInvoice.count({ where }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    updatedByUserId?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id, tenantId },
      include: { supplier: true },
    });
    if (!invoice) {
      throw new NotFoundException('Factura de proveedor no encontrada.');
    }
    const previousStatus = invoice.status;
    const updated = await this.prisma.supplierInvoice.update({
      where: { id },
      data: { status: dto.status },
      include: {
        supplier: true,
        purchaseOrder: true,
      },
    });
    this.logger.log(`Estado de factura ${id} actualizado`, {
      invoiceNumber: invoice.invoiceNumber,
      previousStatus,
      newStatus: dto.status,
      userId: updatedByUserId,
    });
    await this.audit.logUpdate(
      'supplierInvoice',
      id,
      updatedByUserId,
      { status: previousStatus },
      { status: dto.status },
    );
    await this.cache.delete(
      this.cache.buildKey('supplierInvoice', id, tenantId),
    );
    await this.cache.deletePattern('cache:supplierInvoices:*');
    return updated;
  }

  async getSupplierInvoice(id: string, tenantId?: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const cacheKey = this.cache.buildKey('supplierInvoice', id, tenantId);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`SupplierInvoice ${id} retrieved from cache`);
      return cached;
    }

    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        purchaseOrder: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura de proveedor no encontrada.');
    }

    await this.cache.set(cacheKey, invoice, 300);
    return invoice;
  }

  async createPayment(
    invoiceId: string,
    dto: CreatePaymentDto,
    createdByUserId?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { payments: true, supplier: true },
    });

    if (!invoice) {
      throw new NotFoundException('Factura de proveedor no encontrada.');
    }

    if (invoice.status === SupplierInvoiceStatus.CANCELLED) {
      throw new BadRequestException('No se puede pagar una factura cancelada.');
    }

    const currentPaidAmount = Number(invoice.paidAmount);
    const newPaidAmount = currentPaidAmount + dto.amount;
    const grandTotal = Number(invoice.grandTotal);

    if (newPaidAmount > grandTotal) {
      throw new BadRequestException(
        `El monto del pago excede el total de la factura. Total: ${grandTotal}, Ya pagado: ${currentPaidAmount}, Intenta pagar: ${dto.amount}`,
      );
    }

    return this.prisma
      .$transaction(
        async (tx) => {
          const paymentDate = dto.paymentDate
            ? new Date(dto.paymentDate)
            : new Date();

          // Crear registro de pago
          const payment = await tx.supplierPayment.create({
            data: {
              supplierInvoiceId: invoiceId,
              amount: dto.amount,
              paymentDate,
              paymentMethod: dto.paymentMethod,
              reference: dto.reference,
              notes: dto.notes,
              createdBy: createdByUserId,
            },
          });

          // Actualizar monto pagado y estado de la factura (redondeo a 2 decimales para evitar errores de punto flotante)
          let newStatus = invoice.status;
          const paidCents = Math.round(newPaidAmount * 100);
          const totalCents = Math.round(grandTotal * 100);
          if (paidCents >= totalCents) {
            newStatus = SupplierInvoiceStatus.PAID;
          } else if (newPaidAmount > 0) {
            newStatus = SupplierInvoiceStatus.PARTIALLY_PAID;
          }

          // Verificar si está vencida
          if (
            newStatus !== SupplierInvoiceStatus.PAID &&
            invoice.dueDate < new Date()
          ) {
            newStatus = SupplierInvoiceStatus.OVERDUE;
          }

          const updatedInvoice = await tx.supplierInvoice.update({
            where: { id: invoiceId },
            data: {
              paidAmount: Math.round(newPaidAmount * 100) / 100,
              status: newStatus,
            },
            include: {
              supplier: true,
              payments: {
                orderBy: { paymentDate: 'desc' },
              },
            },
          });

          this.logger.log(
            `Pago ${payment.id} registrado para factura ${invoice.invoiceNumber}`,
            {
              invoiceId,
              paymentAmount: dto.amount,
              newPaidAmount,
              newStatus,
              userId: createdByUserId,
            },
          );

          await this.audit.logCreate(
            'supplierPayment',
            payment.id,
            createdByUserId,
            {
              invoiceId,
              amount: dto.amount,
              paymentMethod: dto.paymentMethod,
            },
          );

          await this.audit.logUpdate(
            'supplierInvoice',
            invoiceId,
            createdByUserId,
            {
              paidAmount: currentPaidAmount,
              status: invoice.status,
            },
            {
              paidAmount: newPaidAmount,
              status: newStatus,
            },
          );

          // Registrar el pago como gasto y, si hay sesión de caja abierta, crear movimiento de caja (salida)
          const supplierName = invoice.supplier?.name ?? 'Proveedor';
          const expenseDescription =
            `Factura proveedor ${supplierName} - #${invoice.invoiceNumber}`.slice(
              0,
              255,
            );
          const openSession = await tx.cashSession.findFirst({
            where: { tenantId, closedAt: null },
          });
          const expense = await tx.expense.create({
            data: {
              tenantId: tenantId,
              amount: dto.amount,
              description: expenseDescription,
              category: 'Factura proveedor',
              expenseDate: paymentDate,
              paymentMethod: dto.paymentMethod,
              cashSessionId: openSession?.id ?? null,
              reference: dto.reference?.trim() ?? null,
              createdBy: createdByUserId ?? null,
            },
          });
          if (openSession) {
            const movementReference =
              `Pago factura #${invoice.invoiceNumber} - ${supplierName}`.slice(
                0,
                255,
              );
            await tx.cashMovement.create({
              data: {
                sessionId: openSession.id,
                type: 'OUT',
                method: dto.paymentMethod,
                amount: dto.amount,
                reference: movementReference,
                relatedExpenseId: expense.id,
              },
            });
          }

          return updatedInvoice;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .then(async (updatedInvoice) => {
        await this.cache.delete(
          this.cache.buildKey('supplierInvoice', invoiceId),
        );
        await this.cache.deletePattern('cache:supplierInvoices:*');
        return updatedInvoice;
      });
  }

  async getPendingPayments(tenantId?: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const invoices = await this.prisma.supplierInvoice.findMany({
      where: {
        tenantId,
        status: {
          in: [
            SupplierInvoiceStatus.PENDING,
            SupplierInvoiceStatus.PARTIALLY_PAID,
            SupplierInvoiceStatus.OVERDUE,
          ],
        },
      },
      include: {
        supplier: true,
        purchaseOrder: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    return invoices.map((invoice) => {
      const grandTotal = Number(invoice.grandTotal);
      const paidAmount = Number(invoice.paidAmount);
      return {
        ...invoice,
        remainingAmount: grandTotal - paidAmount,
        isOverdue: invoice.dueDate < new Date(),
        daysUntilDue: Math.ceil(
          (invoice.dueDate.getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      };
    });
  }
}
