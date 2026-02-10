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
import { CustomersService } from './customers.service';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@ApiTags('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar clientes',
    description: 'Obtiene todos los clientes. Respuesta paginada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de clientes',
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
    @Query() query?: ListCustomersQueryDto,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.customers.list(
      {
        page: query?.page,
        limit: query?.limit,
        search: query?.search?.trim() || undefined,
        sortOrder: query?.sortOrder,
      },
      req?.user?.tenantId,
    );
  }

  @Get(':id/sales-stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Estadísticas de compras del cliente',
    description: 'Cantidad de ventas pagadas y monto total. Útil al seleccionar cliente en una venta para decidir descuentos.',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'totalPurchases (número de compras), totalAmount (monto total)',
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getSalesStats(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.customers.getSalesStats(id, req?.user?.tenantId);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener cliente por ID',
    description: 'Obtiene los detalles de un cliente específico',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({ status: 200, description: 'Cliente encontrado' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.customers.get(id, req?.user?.tenantId);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear cliente',
    description: 'Crea un nuevo cliente',
  })
  @ApiResponse({ status: 201, description: 'Cliente creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  create(
    @Body() dto: CreateCustomerDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.customers.create(dto, req.user?.sub, req.user?.tenantId);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar cliente',
    description: 'Actualiza un cliente existente',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({ status: 200, description: 'Cliente actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.customers.update(id, dto, req.user?.sub, req.user?.tenantId);
  }

  @RequirePermission('customers:delete')
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Eliminar cliente',
    description:
      'Elimina un cliente (requiere permiso customers:delete). No se puede eliminar si tiene ventas asociadas.',
  })
  @ApiParam({ name: 'id', description: 'ID del cliente' })
  @ApiResponse({ status: 200, description: 'Cliente eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({ status: 400, description: 'Cliente tiene ventas asociadas' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'No autorizado (requiere permiso customers:delete)',
  })
  delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.customers.delete(
      id,
      req.user?.sub,
      req.user?.tenantId ?? undefined,
    );
  }
}
