import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductDictionaryEntryDto } from './dto/create-product-dictionary-entry.dto';
import { UpdateProductDictionaryEntryDto } from './dto/update-product-dictionary-entry.dto';
import { ListProductDictionaryQueryDto } from './dto/list-product-dictionary-query.dto';
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

  async listProducts(
    pagination?: {
      page?: number;
      limit?: number;
      zeroStock?: boolean;
      lowStock?: boolean;
      lowStockThreshold?: number;
      minStock?: number;
      maxStock?: number;
      search?: string;
      sortByStock?: 'asc' | 'desc';
    },
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { tenantId };

    // Caché para listado por tenant + página (solo primera página sin búsqueda ni filtros)
    const useListCache =
      !pagination?.search?.trim() &&
      page === 1 &&
      limit === 20 &&
      pagination?.zeroStock !== true &&
      pagination?.lowStock !== true &&
      pagination?.minStock == null &&
      pagination?.maxStock == null &&
      !pagination?.sortByStock;
    if (useListCache && tenantId) {
      const listCacheKey = this.cache.buildKey('products', 'list', tenantId, 1, 20);
      const cached = await this.cache.get<{ data: unknown[]; meta: unknown }>(listCacheKey);
      if (cached) return cached;
    }

    // Filtro por stock
    if (pagination?.zeroStock === true) {
      where.stock = { qtyOnHand: 0 };
    } else if (pagination?.lowStock === true) {
      // Stock bajo por producto: qtyOnHand <= COALESCE(product.minStock, threshold). Si minStock no existe (migración pendiente), se usa solo el umbral.
      const threshold = pagination?.lowStockThreshold ?? 10;
      try {
        const [lowStockRows, total] = await Promise.all([
          this.prisma.$queryRaw<{ id: string }[]>`
            SELECT p.id FROM "Product" p
            INNER JOIN "StockBalance" s ON p.id = s."productId"
            WHERE p."tenantId" = ${tenantId}
              AND p."isActive" = true
              AND s."qtyOnHand" <= COALESCE(p."minStock", ${threshold})
            ORDER BY s."qtyOnHand" ASC
            LIMIT ${limit} OFFSET ${skip}
          `,
          this.prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*)::bigint as count FROM "Product" p
            INNER JOIN "StockBalance" s ON p.id = s."productId"
            WHERE p."tenantId" = ${tenantId}
              AND p."isActive" = true
              AND s."qtyOnHand" <= COALESCE(p."minStock", ${threshold})
          `,
        ]);
        const ids = lowStockRows.map((r) => r.id);
        const totalCount = Number(total[0]?.count ?? 0);
        const totalPages = Math.ceil(totalCount / limit);
        if (ids.length === 0) {
          return {
            data: [],
            meta: {
              total: totalCount,
              page,
              limit,
              totalPages,
              hasNextPage: page < totalPages,
              hasPreviousPage: page > 1,
            },
          };
        }
        const data = await this.prisma.product.findMany({
          where: { id: { in: ids } },
          include: { category: true, stock: true },
        });
        const orderMap = new Map(ids.map((id, i) => [id, i]));
        data.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
        return {
          data,
          meta: {
            total: totalCount,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        };
      } catch {
        where.stock = { qtyOnHand: { lte: threshold } };
      }
    } else if (pagination?.minStock != null || pagination?.maxStock != null) {
      const stockConditions: { gte?: number; lte?: number } = {};
      if (pagination?.minStock != null) {
        stockConditions.gte = pagination.minStock;
      }
      if (pagination?.maxStock != null) {
        stockConditions.lte = pagination.maxStock;
      }
      if (Object.keys(stockConditions).length > 0) {
        where.stock = { qtyOnHand: stockConditions };
      }
    }

    // Búsqueda por nombre o código
    if (pagination?.search?.trim()) {
      const searchTerm = pagination.search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { internalCode: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Determinar el ordenamiento
    let orderBy: Array<
      { name?: 'asc' | 'desc' } | { stock?: { qtyOnHand: 'asc' | 'desc' } }
    > = [{ name: 'asc' }];
    if (pagination?.sortByStock) {
      orderBy = [
        { stock: { qtyOnHand: pagination.sortByStock } },
        { name: 'asc' },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: orderBy.length === 1 ? orderBy[0] : orderBy,
        include: { category: true, stock: true },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result = {
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

    if (useListCache && tenantId) {
      const listCacheKey = this.cache.buildKey('products', 'list', tenantId, 1, 20);
      await this.cache.set(listCacheKey, result, 90); // 90 segundos
    }
    return result;
  }

  async getProduct(id: string, tenantId?: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const cacheKey = this.cache.buildKey('product', id, tenantId);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Product ${id} retrieved from cache`);
      return cached;
    }

    const p = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { category: true, stock: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado.');

    // Cachear por 5 minutos
    await this.cache.set(cacheKey, p, 300);
    return p;
  }

  async createProduct(
    dto: CreateProductDto,
    createdByUserId?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const internalCode = dto.internalCode.trim();
    if (!internalCode) throw new BadRequestException('internalCode requerido.');

    const created = await this.prisma.product.create({
      data: {
        tenantId,
        internalCode,
        name: dto.name.trim(),
        categoryId: dto.categoryId ?? null,
        cost: dto.cost,
        price: dto.price,
        taxRate: dto.taxRate ?? 0,
        minStock: dto.minStock ?? null,
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
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const oldProductData = await this.prisma.product.findFirst({
      where: { id, tenantId },
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
        minStock: dto.minStock !== undefined ? dto.minStock : undefined,
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
    await this.cache.delete(this.cache.buildKey('product', id, tenantId));
    await this.cache.deletePattern('cache:products:*');

    return updated;
  }

  async deactivateProduct(
    id: string,
    deactivatedByUserId?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const product = await this.getProduct(id, tenantId);

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

    this.logger.log(`Producto ${id} desactivado exitosamente (${duration}ms)`, {
      productId: id,
      productName: (product as { name: string }).name,
      duration,
      userId: deactivatedByUserId,
    });

    await this.audit.logUpdate(
      'product',
      id,
      deactivatedByUserId,
      { isActive: true },
      { isActive: false },
    );

    // Invalidar caché del producto y listados
    await this.cache.delete(this.cache.buildKey('product', id, tenantId));
    await this.cache.deletePattern('cache:products:*');

    return updated;
  }

  async listCategories(tenantId?: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const cacheKey = this.cache.buildKey('categories', 'list', tenantId);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug('Categories list retrieved from cache');
      return cached;
    }

    const categories = await this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    // Cachear por 10 minutos (categorías cambian poco)
    await this.cache.set(cacheKey, categories, 600);
    return categories;
  }

  async createCategory(
    dto: CreateCategoryDto,
    createdByUserId?: string,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name requerido.');

    const created = await this.prisma.category.create({
      data: { tenantId, name },
    });

    await this.audit.logCreate('category', created.id, createdByUserId, {
      name: created.name,
    });

    // Invalidar caché de categorías
    await this.cache.delete(this.cache.buildKey('categories', 'list'));

    return created;
  }

  // --- Diccionario de términos que los clientes escriben al preguntar por productos ---

  async listProductDictionary(
    query: ListProductDictionaryQueryDto,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');

    const where: Prisma.ProductDictionaryEntryWhereInput = { tenantId };
    if (query?.search?.trim()) {
      where.term = { contains: query.search.trim(), mode: 'insensitive' };
    }
    if (query?.productId) {
      where.productId = query.productId;
    }

    try {
      const entries = await this.prisma.productDictionaryEntry.findMany({
        where,
        orderBy: { term: 'asc' },
        include: {
          product: { select: { id: true, name: true, internalCode: true } },
          category: { select: { id: true, name: true } },
        },
      });
      return { data: entries };
    } catch (err) {
      // Si falta la columna categoryId (migración no aplicada), listar sin include category
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2021' || err.code === 'P2022')
      ) {
        this.logger.warn(
          'ProductDictionaryEntry: categoryId no encontrada en BD. Ejecuta: npm run prisma:migrate',
        );
        const entries = await this.prisma.productDictionaryEntry.findMany({
          where,
          orderBy: { term: 'asc' },
          include: {
            product: { select: { id: true, name: true, internalCode: true } },
          },
        });
        return { data: entries };
      }
      throw err;
    }
  }

  async createProductDictionaryEntry(
    dto: CreateProductDictionaryEntryDto,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');
    const term = dto.term.trim();
    if (!term) throw new BadRequestException('El término no puede estar vacío.');

    if (dto.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, tenantId },
      });
      if (!product) throw new NotFoundException('Producto no encontrado.');
    }
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, tenantId },
      });
      if (!category) throw new NotFoundException('Categoría no encontrada.');
    }

    const created = await this.prisma.productDictionaryEntry.create({
      data: {
        tenantId,
        term: term.slice(0, 200),
        productId: dto.productId ?? null,
        categoryId: dto.categoryId ?? null,
      },
      include: {
        product: { select: { id: true, name: true, internalCode: true } },
        category: { select: { id: true, name: true } },
      },
    });

    return created;
  }

  async updateProductDictionaryEntry(
    id: string,
    dto: UpdateProductDictionaryEntryDto,
    tenantId?: string | null,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');

    const existing = await this.prisma.productDictionaryEntry.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Entrada del diccionario no encontrada.');

    if (dto.productId !== undefined && dto.productId !== null) {
      const product = await this.prisma.product.findFirst({
        where: { id: dto.productId, tenantId },
      });
      if (!product) throw new NotFoundException('Producto no encontrado.');
    }
    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, tenantId },
      });
      if (!category) throw new NotFoundException('Categoría no encontrada.');
    }

    const updated = await this.prisma.productDictionaryEntry.update({
      where: { id },
      data: {
        productId: dto.productId === undefined ? undefined : (dto.productId || null),
        categoryId: dto.categoryId === undefined ? undefined : (dto.categoryId || null),
      },
      include: {
        product: { select: { id: true, name: true, internalCode: true } },
        category: { select: { id: true, name: true } },
      },
    });

    return updated;
  }

  async deleteProductDictionaryEntry(id: string, tenantId?: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant requerido.');

    const existing = await this.prisma.productDictionaryEntry.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Entrada del diccionario no encontrada.');

    await this.prisma.productDictionaryEntry.delete({ where: { id } });
    await this.audit.logDelete('productDictionaryEntry', id, null, {
      term: existing.term,
    });
    return { deleted: true };
  }
}
