import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
} from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('sales')
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar ventas',
    description:
      'Obtiene todas las ventas ordenadas por fecha descendente. Respuesta paginada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de ventas',
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
    @Query() query?: ListSalesQueryDto,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.sales.listSales(
      {
        page: query?.page,
        limit: query?.limit,
        search: query?.search?.trim() || undefined,
      },
      req?.user?.tenantId,
    );
  }

  @Get('invoices')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar facturas de venta',
    description:
      'Obtiene todas las facturas del tenant (paginado). Filtros opcionales por búsqueda y estado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de facturas',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              number: { type: 'string' },
              issuedAt: { type: 'string', format: 'date-time' },
              status: { type: 'string' },
              grandTotal: { type: 'number' },
              customer: { type: 'object' },
              sale: { type: 'object' },
            },
          },
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
  listInvoices(
    @Query() query: ListInvoicesQueryDto,
    @Req() req: { user?: { tenantId?: string } },
  ) {
    return this.sales.listInvoices(req?.user?.tenantId ?? null, {
      page: query?.page,
      limit: query?.limit,
      search: query?.search?.trim() || undefined,
      status: query?.status,
    });
  }

  @Patch('invoices/:id/void')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Anular factura',
    description:
      'Anula una factura emitida: estado VOIDED, venta CANCELLED, devuelve stock y registra movimiento de caja de reversión.',
  })
  @ApiResponse({ status: 200, description: 'Factura anulada' })
  @ApiResponse({ status: 400, description: 'Factura ya anulada o no es emitida' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  voidInvoice(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.sales.voidInvoice(
      id,
      req?.user?.tenantId ?? null,
      req?.user?.sub,
    );
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener venta por ID',
    description: 'Obtiene los detalles de una venta específica',
  })
  @ApiResponse({ status: 200, description: 'Venta encontrada' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getSale(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { tenantId?: string } },
  ) {
    return this.sales.getSale(id, req?.user?.tenantId ?? null);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear venta',
    description:
      'Crea una venta, descuenta stock, registra movimiento de caja, crea factura y documento DIAN',
  })
  @ApiResponse({ status: 201, description: 'Venta creada exitosamente' })
  @ApiResponse({
    status: 400,
    description:
      'Error de validación (stock insuficiente, productos inexistentes, etc.)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  create(
    @Body() dto: CreateSaleDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.sales.createSale(dto, req.user?.sub, req.user?.tenantId);
  }
}
