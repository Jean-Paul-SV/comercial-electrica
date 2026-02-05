import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuditService } from '../common/services/audit.service';
import { CacheService } from '../common/services/cache.service';
import type { Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  async list(
    pagination?: {
      page?: number;
      limit?: number;
      search?: string;
      sortOrder?: 'asc' | 'desc';
    },
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = pagination?.search?.trim();
    const order = pagination?.sortOrder ?? 'asc';

    const where: Prisma.CustomerWhereInput = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { docNumber: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: order },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
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

  async get(id: string, tenantId?: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const cacheKey = this.cache.buildKey('customer', id, tenantId);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Customer ${id} retrieved from cache`);
      return cached;
    }

    const c = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
    if (!c) throw new NotFoundException('Cliente no encontrado.');

    // Cachear por 5 minutos
    await this.cache.set(cacheKey, c, 300);
    return c;
  }

  async create(
    dto: CreateCustomerDto,
    createdByUserId?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const startTime = Date.now();
    this.logger.log(`Creando cliente ${dto.docNumber}`, {
      docType: dto.docType,
      docNumber: dto.docNumber,
      name: dto.name,
      userId: createdByUserId,
    });

    const created = await this.prisma.customer.create({
      data: {
        tenantId,
        docType: dto.docType,
        docNumber: dto.docNumber.trim(),
        name: dto.name.trim(),
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        address: dto.address,
        cityCode: dto.cityCode,
      },
    });
    const duration = Date.now() - startTime;

    this.logger.log(
      `Cliente ${created.id} creado exitosamente (${duration}ms)`,
      {
        customerId: created.id,
        name: created.name,
        docNumber: created.docNumber,
        duration,
        userId: createdByUserId,
      },
    );

    await this.audit.logCreate('customer', created.id, createdByUserId, {
      name: created.name,
      docType: created.docType,
      docNumber: created.docNumber,
    });

    // Invalidar caché de listados
    await this.cache.deletePattern('cache:customers:*');

    return created;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    updatedByUserId?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const oldCustomerData = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
    if (!oldCustomerData) throw new NotFoundException('Cliente no encontrado.');

    const oldCustomer = oldCustomerData;
    const startTime = Date.now();
    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        docType: dto.docType ?? undefined,
        docNumber: dto.docNumber?.trim(),
        name: dto.name?.trim(),
        email: dto.email?.toLowerCase(),
        phone: dto.phone ?? undefined,
        address: dto.address ?? undefined,
        cityCode: dto.cityCode ?? undefined,
      },
    });
    const duration = Date.now() - startTime;

    this.logger.log(`Cliente ${id} actualizado exitosamente (${duration}ms)`, {
      customerId: id,
      customerName: updated.name,
      duration,
      userId: updatedByUserId,
    });

    await this.audit.logUpdate(
      'customer',
      id,
      updatedByUserId,
      {
        name: oldCustomer.name,
        email: oldCustomer.email,
        phone: oldCustomer.phone,
      },
      {
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
      },
    );

    // Invalidar caché del cliente y listados
    await this.cache.delete(this.cache.buildKey('customer', id));
    await this.cache.deletePattern('cache:customers:*');

    return updated;
  }

  async delete(id: string, deletedByUserId?: string, tenantId?: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    // Validar que no tiene ventas, cotizaciones ni facturas asociadas
    const [salesCount, quotesCount, invoicesCount] = await Promise.all([
      this.prisma.sale.count({ where: { customerId: id } }),
      this.prisma.quote.count({ where: { customerId: id } }),
      this.prisma.invoice.count({ where: { customerId: id } }),
    ]);

    if (salesCount > 0) {
      this.logger.warn(
        `Intento de eliminar cliente ${id} con ${salesCount} ventas asociadas`,
      );
      throw new BadRequestException(
        `No se puede eliminar el cliente. Tiene ${salesCount} venta(s) asociada(s).`,
      );
    }
    if (quotesCount > 0) {
      this.logger.warn(
        `Intento de eliminar cliente ${id} con ${quotesCount} cotizaciones asociadas`,
      );
      throw new BadRequestException(
        `No se puede eliminar el cliente. Tiene ${quotesCount} cotización(es) asociada(s).`,
      );
    }
    if (invoicesCount > 0) {
      this.logger.warn(
        `Intento de eliminar cliente ${id} con ${invoicesCount} facturas asociadas`,
      );
      throw new BadRequestException(
        `No se puede eliminar el cliente. Tiene ${invoicesCount} factura(s) asociada(s).`,
      );
    }

    const startTime = Date.now();
    await this.prisma.customer.delete({ where: { id } });
    const duration = Date.now() - startTime;

    this.logger.log(`Cliente ${id} eliminado exitosamente (${duration}ms)`, {
      customerId: id,
      customerName: customer.name,
      duration,
      userId: deletedByUserId,
    });

    await this.audit.logDelete('customer', id, deletedByUserId, {
      name: customer.name,
      docType: customer.docType,
      docNumber: customer.docNumber,
    });

    // Invalidar caché del cliente y listados
    if (tenantId)
      await this.cache.delete(this.cache.buildKey('customer', id, tenantId));
    await this.cache.deletePattern('cache:customers:*');
  }
}
