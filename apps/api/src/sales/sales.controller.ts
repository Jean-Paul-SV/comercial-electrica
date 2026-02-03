import {
  Body,
  Controller,
  Get,
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
  create(@Body() dto: CreateSaleDto, @Req() req: { user?: { sub?: string; tenantId?: string } }) {
    return this.sales.createSale(dto, req.user?.sub, req.user?.tenantId);
  }
}
