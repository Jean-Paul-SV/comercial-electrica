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
import { SuppliersService } from './suppliers.service';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ModulesGuard } from '../auth/modules.guard';
import { RequireModule } from '../auth/require-module.decorator';

@ApiTags('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard, ModulesGuard)
@RequireModule('suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar proveedores',
    description:
      'Obtiene proveedores paginados. Query isActive=true devuelve solo activos (para selects); sin isActive devuelve todos (incl. deshabilitados).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de proveedores',
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
  list(
    @Query() query?: ListSuppliersQueryDto,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    const isActive =
      query?.isActive === 'true' ? true : query?.isActive === 'false' ? false : undefined;
    return this.suppliers.list(
      {
        page: query?.page,
        limit: query?.limit,
        isActive,
        search: query?.search?.trim() || undefined,
      },
      req?.user?.tenantId,
    );
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener proveedor por ID',
    description: 'Obtiene los detalles de un proveedor específico',
  })
  @ApiParam({ name: 'id', description: 'ID del proveedor' })
  @ApiResponse({ status: 200, description: 'Proveedor encontrado' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.suppliers.get(id, req?.user?.tenantId);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear proveedor',
    description: 'Crea un nuevo proveedor',
  })
  @ApiResponse({ status: 201, description: 'Proveedor creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  create(
    @Body() dto: CreateSupplierDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.suppliers.create(dto, req.user?.sub, req.user?.tenantId);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar proveedor',
    description: 'Actualiza un proveedor existente',
  })
  @ApiParam({ name: 'id', description: 'ID del proveedor' })
  @ApiResponse({ status: 200, description: 'Proveedor actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSupplierDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.suppliers.update(id, dto, req.user?.sub, req.user?.tenantId);
  }

  @RequirePermission('suppliers:delete')
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Eliminar proveedor',
    description: 'Desactiva un proveedor (requiere permiso suppliers:delete). No se puede eliminar si tiene movimientos asociados.',
  })
  @ApiParam({ name: 'id', description: 'ID del proveedor' })
  @ApiResponse({ status: 200, description: 'Proveedor desactivado exitosamente' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  @ApiResponse({ status: 400, description: 'Proveedor tiene movimientos asociados' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere permiso suppliers:delete)' })
  delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.suppliers.delete(id, req.user?.sub, req.user?.tenantId);
  }
}
