import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listProducts() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { category: true, stock: true },
    });
  }

  async getProduct(id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, stock: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado.');
    return p;
  }

  async createProduct(dto: CreateProductDto) {
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
    return created;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    await this.getProduct(id);
    return this.prisma.product.update({
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
  }

  async deactivateProduct(id: string) {
    await this.getProduct(id);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { name: dto.name.trim() } });
  }
}
