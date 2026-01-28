import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar productos',
    description: 'Obtiene todos los productos activos. Respuesta paginada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de productos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
            hasNextPage: { type: 'boolean' },
            hasPreviousPage: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  listProducts(@Query() pagination?: PaginationDto) {
    return this.catalog.listProducts({
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }

  @Get('products/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener producto por ID',
    description: 'Obtiene los detalles de un producto específico',
  })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiResponse({ status: 200, description: 'Producto encontrado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getProduct(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.catalog.getProduct(id);
  }

  @Roles(RoleName.ADMIN)
  @Post('products')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear producto',
    description: 'Crea un nuevo producto (requiere rol ADMIN)',
  })
  @ApiResponse({ status: 201, description: 'Producto creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  createProduct(
    @Body() dto: CreateProductDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.catalog.createProduct(dto, req.user?.sub);
  }

  @Roles(RoleName.ADMIN)
  @Patch('products/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar producto',
    description: 'Actualiza un producto existente (requiere rol ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiResponse({
    status: 200,
    description: 'Producto actualizado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  updateProduct(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.catalog.updateProduct(id, dto, req.user?.sub);
  }

  @Roles(RoleName.ADMIN)
  @Delete('products/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Desactivar producto',
    description: 'Desactiva un producto (requiere rol ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiResponse({
    status: 200,
    description: 'Producto desactivado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  deactivate(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.catalog.deactivateProduct(id);
  }

  @Get('categories')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar categorías',
    description: 'Obtiene todas las categorías',
  })
  @ApiResponse({ status: 200, description: 'Lista de categorías' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  listCategories() {
    return this.catalog.listCategories();
  }

  @Roles(RoleName.ADMIN)
  @Post('categories')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear categoría',
    description: 'Crea una nueva categoría (requiere rol ADMIN)',
  })
  @ApiResponse({ status: 201, description: 'Categoría creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  createCategory(
    @Body() dto: CreateCategoryDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.catalog.createCategory(dto, req.user?.sub);
  }
}
