import {
  Body,
  Controller,
  Get,
  Patch,
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
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { RequireModule } from '../auth/require-module.decorator';
import { SupplierInvoiceStatus } from '@prisma/client';

@ApiTags('supplier-invoices')
@UseGuards(JwtAuthGuard, ModulesGuard)
@RequireModule('suppliers')
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
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar por número de factura o nombre del proveedor',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de facturas de proveedores',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  list(
    @Query()
    pagination?: PaginationDto & {
      status?: SupplierInvoiceStatus;
      supplierId?: string;
      search?: string;
    },
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.invoices.listSupplierInvoices(
      {
        page: pagination?.page,
        limit: pagination?.limit,
        status: pagination?.status,
        supplierId: pagination?.supplierId,
        search: pagination?.search,
      },
      req?.user?.tenantId,
    );
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
    description:
      'Lista de facturas pendientes con información de días hasta vencimiento',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getPendingPayments(@Req() req?: { user?: { tenantId?: string } }) {
    return this.invoices.getPendingPayments(req?.user?.tenantId);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener factura de proveedor por ID',
    description:
      'Obtiene los detalles de una factura de proveedor específica con historial de pagos',
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
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.invoices.createSupplierInvoice(
      dto,
      req.user?.sub,
      req.user?.tenantId,
    );
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar estado de la factura',
    description:
      'Cambia el estado de una factura de proveedor (ej. Pendiente, Pagada, Cancelada).',
  })
  @ApiParam({ name: 'id', description: 'ID de la factura de proveedor' })
  @ApiResponse({ status: 200, description: 'Factura actualizada' })
  @ApiResponse({ status: 404, description: 'Factura no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.invoices.updateStatus(
      id,
      dto,
      req.user?.sub,
      req.user?.tenantId,
    );
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
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.invoices.createPayment(
      id,
      dto,
      req.user?.sub,
      req.user?.tenantId,
    );
  }
}
