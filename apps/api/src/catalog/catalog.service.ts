import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuditService } from '../common/services/audit.service';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  async listProducts(pagination?: { page?: number; limit?: number }) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        orderBy: { name: 'asc' },
        include: { category: true, stock: true },
        skip,
        take: limit,
      }),
      this.prisma.product.count(),
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

  async getProduct(id: string) {
    const cacheKey = this.cache.buildKey('product', id);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Product ${id} retrieved from cache`);
      return cached;
    }

    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, stock: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado.');

    // Cachear por 5 minutos
    await this.cache.set(cacheKey, p, 300);
    return p;
  }

  async createProduct(dto: CreateProductDto, createdByUserId?: string) {
    const internalCode = dto.internalCode.trim();
    if (!internalCode) throw new BadRequestException('internalCode requerido.');

    const created = await this.prisma.product.create({
      data: {
        internalCode,
        name: dto.name.trim(),
        categoryId: dto.categoryId ?? null,
        cost: dto.cost,
        price: dto.price,
        taxRate: dto.taxRate ?? 0,
        isActive: dto.isActive ?? true,
        stock: { create: {} },
      },
      include: { category: true, stock: true },
    });

    await this.audit.logCreate('product', created.id, createdByUserId, {
      internalCode: created.internalCode,
      name: created.name,
      price: Number(created.price),
    });

    // Invalidar caché de listado
    await this.cache.deletePattern('cache:products:*');

    return created;
  }

  async updateProduct(
    id: string,
    dto: UpdateProductDto,
    updatedByUserId?: string,
  ) {
    const oldProductData = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, stock: true },
    });
    if (!oldProductData) throw new NotFoundException('Producto no encontrado.');

    const oldProduct = oldProductData;
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        internalCode: dto.internalCode?.trim(),
        name: dto.name?.trim(),
        categoryId: dto.categoryId ?? undefined,
        cost: dto.cost ?? undefined,
        price: dto.price ?? undefined,
        taxRate: dto.taxRate ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
      include: { category: true, stock: true },
    });

    await this.audit.logUpdate(
      'product',
      id,
      updatedByUserId,
      {
        internalCode: oldProduct.internalCode,
        name: oldProduct.name,
        price: Number(oldProduct.price),
        isActive: oldProduct.isActive,
      },
      {
        internalCode: updated.internalCode,
        name: updated.name,
        price: Number(updated.price),
        isActive: updated.isActive,
      },
    );

    // Invalidar caché del producto y listados
    await this.cache.delete(this.cache.buildKey('product', id));
    await this.cache.deletePattern('cache:products:*');

    return updated;
  }

  async deactivateProduct(id: string, deactivatedByUserId?: string) {
    const product = await this.getProduct(id);

    // Validar que no tiene ventas asociadas
    const salesCount = await this.prisma.saleItem.count({
      where: { productId: id },
    });

    if (salesCount > 0) {
      this.logger.warn(
        `Intento de desactivar producto ${id} con ${salesCount} ventas asociadas`,
      );
      throw new BadRequestException(
        `No se puede desactivar el producto. Tiene ${salesCount} venta(s) asociada(s).`,
      );
    }

    const startTime = Date.now();
    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    const duration = Date.now() - startTime;

    this.logger.log(
      `Producto ${id} desactivado exitosamente (${duration}ms)`,
      {
        productId: id,
        productName: (product as { name: string }).name,
        duration,
        userId: deactivatedByUserId,
      },
    );

    await this.audit.logUpdate(
      'product',
      id,
      deactivatedByUserId,
      { isActive: true },
      { isActive: false },
    );

    // Invalidar caché del producto y listados
    await this.cache.delete(this.cache.buildKey('product', id));
    await this.cache.deletePattern('cache:products:*');

    return updated;
  }

  async listCategories() {
    const cacheKey = this.cache.buildKey('categories', 'list');
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug('Categories list retrieved from cache');
      return cached;
    }

    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    // Cachear por 10 minutos (categorías cambian poco)
    await this.cache.set(cacheKey, categories, 600);
    return categories;
  }

  async createCategory(dto: CreateCategoryDto, createdByUserId?: string) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name requerido.');

    const created = await this.prisma.category.create({
      data: { name },
    });

    await this.audit.logCreate('category', created.id, createdByUserId, {
      name: created.name,
    });

    // Invalidar caché de categorías
    await this.cache.delete(this.cache.buildKey('categories', 'list'));

    return created;
  }
}
