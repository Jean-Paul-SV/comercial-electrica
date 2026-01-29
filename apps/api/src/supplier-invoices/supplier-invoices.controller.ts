import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Param,
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
import { SupplierInvoicesService } from './supplier-invoices.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SupplierInvoiceStatus } from '@prisma/client';

@ApiTags('supplier-invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('supplier-invoices')
export class SupplierInvoicesController {
  constructor(private readonly invoices: SupplierInvoicesService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar facturas de proveedores',
    description:
      'Obtiene todas las facturas de proveedores. Respuesta paginada. Filtrable por estado y proveedor.',
  })
  @ApiQuery({
    name: 'status',
    enum: SupplierInvoiceStatus,
    required: false,
    description: 'Filtrar por estado',
  })
  @ApiQuery({
    name: 'supplierId',
    required: false,
    description: 'Filtrar por ID de proveedor',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de facturas de proveedores',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  list(
    @Query() pagination?: PaginationDto & { status?: SupplierInvoiceStatus; supplierId?: string },
  ) {
    return this.invoices.listSupplierInvoices({
      page: pagination?.page,
      limit: pagination?.limit,
      status: pagination?.status,
      supplierId: pagination?.supplierId,
    });
  }

  @Get('pending')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener facturas pendientes de pago',
    description:
      'Obtiene todas las facturas pendientes, parcialmente pagadas o vencidas, ordenadas por fecha de vencimiento',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de facturas pendientes con información de días hasta vencimiento',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getPendingPayments() {
    return this.invoices.getPendingPayments();
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener factura de proveedor por ID',
    description: 'Obtiene los detalles de una factura de proveedor específica con historial de pagos',
  })
  @ApiParam({ name: 'id', description: 'ID de la factura de proveedor' })
  @ApiResponse({ status: 200, description: 'Factura encontrada' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.invoices.getSupplierInvoice(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear factura de proveedor',
    description:
      'Crea una nueva factura de proveedor con fecha de vencimiento. Puede estar asociada a un pedido de compra.',
  })
  @ApiResponse({ status: 201, description: 'Factura creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  create(
    @Body() dto: CreateSupplierInvoiceDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.invoices.createSupplierInvoice(dto, req.user?.sub);
  }

  @Post(':id/payments')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Registrar pago de factura',
    description:
      'Registra un pago parcial o completo contra una factura de proveedor. Actualiza automáticamente el estado de la factura.',
  })
  @ApiParam({ name: 'id', description: 'ID de la factura de proveedor' })
  @ApiResponse({ status: 201, description: 'Pago registrado exitosamente' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  createPayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreatePaymentDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.invoices.createPayment(id, dto, req.user?.sub);
  }
}
