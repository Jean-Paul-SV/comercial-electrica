import {
  Body,
  Controller,
  Get,
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
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { ConvertQuoteDto } from './dto/convert-quote.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { QuoteStatus } from '@prisma/client';

@ApiTags('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear cotización',
    description:
      'Crea una nueva cotización con productos. La cotización se crea en estado DRAFT y tiene validez de 30 días por defecto.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cotización creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'Error de validación (productos inexistentes, items vacíos, etc.)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  create(@Body() dto: CreateQuoteDto, @Req() req: { user?: { sub?: string } }) {
    return this.quotesService.createQuote(dto, req.user?.sub);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar cotizaciones',
    description:
      'Obtiene todas las cotizaciones con filtros opcionales por estado y cliente',
  })
  @ApiQuery({
    name: 'status',
    enum: QuoteStatus,
    required: false,
    description: 'Filtrar por estado de cotización',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    description: 'Filtrar por ID de cliente',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Límite de resultados (por defecto 200)',
  })
  @ApiResponse({ status: 200, description: 'Lista de cotizaciones' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  list(
    @Query('status') status?: QuoteStatus,
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.quotesService.listQuotes({
      status,
      customerId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener cotización por ID',
    description: 'Obtiene los detalles completos de una cotización',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({ status: 200, description: 'Cotización encontrada' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getById(@Param('id') id: string) {
    return this.quotesService.getQuoteById(id);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar cotización',
    description:
      'Actualiza una cotización. No se pueden actualizar cotizaciones convertidas o canceladas.',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Cotización actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación o cotización no puede ser actualizada',
  })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.quotesService.updateQuote(id, dto, req.user?.sub);
  }

  @Post(':id/convert')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Convertir cotización a venta',
    description:
      'Convierte una cotización en una venta. Valida stock, descuenta inventario, crea movimiento de caja, factura y documento DIAN.',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización a convertir' })
  @ApiResponse({
    status: 201,
    description: 'Cotización convertida a venta exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'Error de validación (cotización ya convertida, cancelada, expirada, stock insuficiente, etc.)',
  })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertQuoteDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.quotesService.convertQuoteToSale(id, dto, req.user?.sub);
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cambiar estado de cotización',
    description:
      'Cambia el estado de una cotización (DRAFT, SENT, EXPIRED, CONVERTED, CANCELLED)',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({ status: 200, description: 'Estado actualizado exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'Error de validación (no se puede cambiar el estado)',
  })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: QuoteStatus,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.quotesService.updateQuoteStatus(id, status, req.user?.sub);
  }
}
