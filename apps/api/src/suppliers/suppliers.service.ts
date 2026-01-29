import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { AuditService } from '../common/services/audit.service';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  async list(pagination?: { page?: number; limit?: number }) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.supplier.count({ where: { isActive: true } }),
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

  async get(id: string) {
    const cacheKey = this.cache.buildKey('supplier', id);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Supplier ${id} retrieved from cache`);
      return cached;
    }

    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Proveedor no encontrado.');

    // Cachear por 5 minutos
    await this.cache.set(cacheKey, s, 300);
    return s;
  }

  async create(dto: CreateSupplierDto, createdByUserId?: string) {
    const startTime = Date.now();
    this.logger.log(`Creando proveedor ${dto.nit}`, {
      nit: dto.nit,
      name: dto.name,
      userId: createdByUserId,
    });

    try {
      const created = await this.prisma.supplier.create({
        data: {
          nit: dto.nit.trim(),
          name: dto.name.trim(),
          email: dto.email?.toLowerCase(),
          phone: dto.phone,
          address: dto.address,
          cityCode: dto.cityCode,
          contactPerson: dto.contactPerson,
        },
      });
      const duration = Date.now() - startTime;

      this.logger.log(
        `Proveedor ${created.id} creado exitosamente (${duration}ms)`,
        {
          supplierId: created.id,
          name: created.name,
          nit: created.nit,
          duration,
          userId: createdByUserId,
        },
      );

      await this.audit.logCreate('supplier', created.id, createdByUserId, {
        name: created.name,
        nit: created.nit,
      });

      // Invalidar caché de listados
      await this.cache.deletePattern('cache:suppliers:*');

      return created;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Ya existe un proveedor con NIT ${dto.nit}`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateSupplierDto, updatedByUserId?: string) {
    const oldSupplierData = await this.prisma.supplier.findUnique({
      where: { id },
    });
    if (!oldSupplierData)
      throw new NotFoundException('Proveedor no encontrado.');

    const oldSupplier = oldSupplierData;
    const startTime = Date.now();

    try {
      const updated = await this.prisma.supplier.update({
        where: { id },
        data: {
          nit: dto.nit?.trim(),
          name: dto.name?.trim(),
          email: dto.email?.toLowerCase(),
          phone: dto.phone ?? undefined,
          address: dto.address ?? undefined,
          cityCode: dto.cityCode ?? undefined,
          contactPerson: dto.contactPerson ?? undefined,
        },
      });
      const duration = Date.now() - startTime;

      this.logger.log(
        `Proveedor ${id} actualizado exitosamente (${duration}ms)`,
        {
          supplierId: id,
          supplierName: updated.name,
          duration,
          userId: updatedByUserId,
        },
      );

      await this.audit.logUpdate(
        'supplier',
        id,
        updatedByUserId,
        {
          name: oldSupplier.name,
          email: oldSupplier.email,
          phone: oldSupplier.phone,
        },
        {
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
        },
      );

      // Invalidar caché del proveedor y listados
      await this.cache.delete(this.cache.buildKey('supplier', id));
      await this.cache.deletePattern('cache:suppliers:*');

      return updated;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException(
          `Ya existe un proveedor con NIT ${dto.nit}`,
        );
      }
      throw error;
    }
  }

  async delete(id: string, deletedByUserId?: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado.');
    }

    // Validar que no tiene movimientos de inventario asociados
    const movementsCount = await this.prisma.inventoryMovement.count({
      where: { supplierId: id },
    });

    if (movementsCount > 0) {
      this.logger.warn(
        `Intento de eliminar proveedor ${id} con ${movementsCount} movimientos asociados`,
      );
      throw new BadRequestException(
        `No se puede eliminar el proveedor. Tiene ${movementsCount} movimiento(s) de inventario asociado(s).`,
      );
    }

    // Soft delete: marcar como inactivo
    const startTime = Date.now();
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
    const duration = Date.now() - startTime;

    this.logger.log(
      `Proveedor ${id} desactivado exitosamente (${duration}ms)`,
      {
        supplierId: id,
        supplierName: supplier.name,
        duration,
        userId: deletedByUserId,
      },
    );

    await this.audit.logDelete('supplier', id, deletedByUserId, {
      name: supplier.name,
      nit: supplier.nit,
    });

    // Invalidar caché del proveedor y listados
    await this.cache.delete(this.cache.buildKey('supplier', id));
    await this.cache.deletePattern('cache:suppliers:*');

    return updated;
  }
}
