import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  listProducts() {
    return this.catalog.listProducts();
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.catalog.getProduct(id);
  }

  @Roles(RoleName.ADMIN)
  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalog.createProduct(dto);
  }

  @Roles(RoleName.ADMIN)
  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.catalog.updateProduct(id, dto);
  }

  @Roles(RoleName.ADMIN)
  @Delete('products/:id')
  deactivate(@Param('id') id: string) {
    return this.catalog.deactivateProduct(id);
  }

  @Get('categories')
  listCategories() {
    return this.catalog.listCategories();
  }

  @Roles(RoleName.ADMIN)
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }
}

