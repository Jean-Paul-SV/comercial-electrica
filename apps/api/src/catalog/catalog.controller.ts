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
  ApiQuery,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateProductDictionaryEntryDto } from './dto/create-product-dictionary-entry.dto';
import { UpdateProductDictionaryEntryDto } from './dto/update-product-dictionary-entry.dto';
import { ListProductDictionaryQueryDto } from './dto/list-product-dictionary-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@ApiTags('catalog')
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @ApiQuery({
    name: 'zeroStock',
    required: false,
    type: Boolean,
    description: 'Solo productos con 0 unidades',
  })
  @ApiQuery({
    name: 'lowStock',
    required: false,
    type: Boolean,
    description: 'Solo productos con stock bajo',
  })
  @ApiQuery({
    name: 'lowStockThreshold',
    required: false,
    type: Number,
    description: 'Umbral de stock bajo (por defecto 10)',
  })
  @ApiQuery({
    name: 'minStock',
    required: false,
    type: Number,
    description: 'Stock mínimo',
  })
  @ApiQuery({
    name: 'maxStock',
    required: false,
    type: Number,
    description: 'Stock máximo',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Buscar por nombre o código',
  })
  @ApiQuery({
    name: 'sortByStock',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Ordenar por stock: asc = menor a mayor, desc = mayor a menor',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  listProducts(
    @Query() query?: ListProductsQueryDto,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    const zeroStock = query?.zeroStock === 'true' || query?.zeroStock === '1';
    const lowStock = query?.lowStock === 'true' || query?.lowStock === '1';
    return this.catalog.listProducts(
      {
        page: query?.page,
        limit: query?.limit,
        zeroStock: zeroStock || undefined,
        lowStock: lowStock && !zeroStock ? true : undefined,
        lowStockThreshold: query?.lowStockThreshold,
        minStock: query?.minStock,
        maxStock: query?.maxStock,
        search: query?.search?.trim() || undefined,
        sortByStock: query?.sortByStock,
      },
      req?.user?.tenantId,
    );
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
  getProduct(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.catalog.getProduct(id, req?.user?.tenantId);
  }

  @Post('products')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear producto',
    description: 'Crea un nuevo producto (requiere autenticación)',
  })
  @ApiResponse({ status: 201, description: 'Producto creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  createProduct(
    @Body() dto: CreateProductDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.catalog.createProduct(dto, req.user?.sub, req.user?.tenantId);
  }

  @Patch('products/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar producto',
    description: 'Actualiza un producto existente (requiere autenticación)',
  })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiResponse({
    status: 200,
    description: 'Producto actualizado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  updateProduct(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.catalog.updateProduct(
      id,
      dto,
      req.user?.sub,
      req.user?.tenantId,
    );
  }

  @RequirePermission('catalog:delete')
  @Delete('products/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Desactivar producto',
    description: 'Desactiva un producto (requiere permiso catalog:delete)',
  })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiResponse({
    status: 200,
    description: 'Producto desactivado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'No autorizado (requiere permiso catalog:delete)',
  })
  deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.catalog.deactivateProduct(
      id,
      req.user?.sub,
      req.user?.tenantId,
    );
  }

  @Get('categories')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar categorías',
    description: 'Obtiene todas las categorías',
  })
  @ApiResponse({ status: 200, description: 'Lista de categorías' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  listCategories(@Req() req?: { user?: { tenantId?: string } }) {
    return this.catalog.listCategories(req?.user?.tenantId);
  }

  @Post('categories')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear categoría',
    description: 'Crea una nueva categoría (requiere autenticación)',
  })
  @ApiResponse({ status: 201, description: 'Categoría creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  createCategory(
    @Body() dto: CreateCategoryDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.catalog.createCategory(dto, req.user?.sub, req.user?.tenantId);
  }

  @Patch('categories/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar categoría',
    description: 'Actualiza el nombre de una categoría existente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Categoría actualizada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.catalog.updateCategory(
      id,
      dto,
      req.user?.sub,
      req.user?.tenantId,
    );
  }

  @Delete('categories/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Eliminar categoría',
    description:
      'Elimina una categoría sin productos asociados. Si hay productos que la usan, devuelve un error.',
  })
  @ApiResponse({ status: 200, description: 'Categoría eliminada exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar por tener productos asociados',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  deleteCategory(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.catalog.deleteCategory(id, req.user?.sub, req.user?.tenantId);
  }

  // --- Diccionario de términos que los clientes escriben al preguntar por productos ---

  @Get('product-dictionary')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar diccionario de búsqueda',
    description:
      'Términos o frases que los clientes escriben al preguntar por productos. Opcionalmente vinculados a un producto.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filtrar por texto en el término',
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    description: 'Filtrar por producto asociado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de entradas del diccionario',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  listProductDictionary(
    @Query() query: ListProductDictionaryQueryDto,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.catalog.listProductDictionary(query, req?.user?.tenantId);
  }

  @Post('product-dictionary')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Agregar término al diccionario',
    description:
      'Registra un término o frase que los clientes escriben al preguntar por productos.',
  })
  @ApiResponse({ status: 201, description: 'Entrada creada' })
  @ApiResponse({ status: 400, description: 'Validación fallida' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  createProductDictionaryEntry(
    @Body() dto: CreateProductDictionaryEntryDto,
    @Req() req: { user?: { tenantId?: string } },
  ) {
    return this.catalog.createProductDictionaryEntry(dto, req.user?.tenantId);
  }

  @Patch('product-dictionary/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar entrada del diccionario',
    description: 'Cambia el producto asociado a un término.',
  })
  @ApiParam({ name: 'id', description: 'ID de la entrada' })
  @ApiResponse({ status: 200, description: 'Entrada actualizada' })
  @ApiResponse({ status: 404, description: 'Entrada no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  updateProductDictionaryEntry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProductDictionaryEntryDto,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.catalog.updateProductDictionaryEntry(
      id,
      dto,
      req?.user?.tenantId,
    );
  }

  @Delete('product-dictionary/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Eliminar entrada del diccionario',
  })
  @ApiParam({ name: 'id', description: 'ID de la entrada' })
  @ApiResponse({ status: 200, description: 'Entrada eliminada' })
  @ApiResponse({ status: 404, description: 'Entrada no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  deleteProductDictionaryEntry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.catalog.deleteProductDictionaryEntry(id, req?.user?.tenantId);
  }
}
