import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { SalesReportDto } from './dto/sales-report.dto';
import { InventoryReportDto } from './dto/inventory-report.dto';
import { CashReportDto } from './dto/cash-report.dto';
import { CustomersReportDto } from './dto/customers-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reporte de ventas',
    description:
      'Obtiene un reporte detallado de ventas con filtros opcionales por fecha y cliente. Incluye totales y estadísticas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de ventas generado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getSalesReport(@Query() dto: SalesReportDto) {
    return this.reportsService.getSalesReport(dto);
  }

  @Get('inventory')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reporte de inventario',
    description:
      'Obtiene un reporte del estado del inventario. Puede filtrar por stock bajo y categoría. Incluye estadísticas de inventario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de inventario generado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getInventoryReport(@Query() dto: InventoryReportDto) {
    return this.reportsService.getInventoryReport(dto);
  }

  @Get('cash')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reporte de caja',
    description:
      'Obtiene un reporte de sesiones de caja con movimientos y diferencias. Puede filtrar por sesión específica o rango de fechas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de caja generado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getCashReport(@Query() dto: CashReportDto) {
    return this.reportsService.getCashReport(dto);
  }

  @Get('customers')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reporte de clientes',
    description:
      'Obtiene un reporte de los mejores clientes basado en ventas. Puede filtrar por período y limitar el número de resultados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de clientes generado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getCustomersReport(@Query() dto: CustomersReportDto) {
    return this.reportsService.getCustomersReport(dto);
  }

  @Get('dashboard')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Dashboard ejecutivo',
    description:
      'Obtiene KPIs principales del sistema: ventas del día, productos con stock bajo, sesiones de caja abiertas, cotizaciones pendientes, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard generado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getDashboard() {
    return this.reportsService.getDashboard();
  }
}
