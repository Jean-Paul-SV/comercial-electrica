import {
  Controller,
  Get,
  Query,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
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
import { ExportReportDto } from './dto/export-report.dto';
import { ActionableIndicatorsDto } from './dto/actionable-indicators.dto';
import { CustomerClustersDto } from './dto/customer-clusters.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { RequireModule } from '../auth/require-module.decorator';

@ApiTags('reports')
@UseGuards(JwtAuthGuard, ModulesGuard)
@RequireModule('advanced_reports')
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

  @Get('export')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Exportar datos a CSV',
    description:
      'Exporta ventas o clientes a CSV para descarga. Útil para respaldo o trabajar sin conexión estable.',
  })
  @ApiQuery({
    name: 'entity',
    enum: ['sales', 'customers'],
    description: 'Entidad a exportar',
  })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: 200,
    description: 'Archivo CSV',
    content: { 'text/csv': {} },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async export(@Query() dto: ExportReportDto): Promise<StreamableFile> {
    const { csv, fileName } = await this.reportsService.exportAsCsv(dto);
    return new StreamableFile(Buffer.from(csv, 'utf-8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Get('actionable-indicators')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Indicadores accionables',
    description:
      'Indicadores que dicen "qué hacer": productos con pérdida, sin rotación, facturas vencidas, margen bajo. Cada uno incluye insight, acción sugerida y enlace.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Días hacia atrás (7-365)',
  })
  @ApiQuery({
    name: 'top',
    required: false,
    description: 'Máximo ítems por indicador',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de indicadores accionables',
    schema: {
      type: 'object',
      properties: {
        periodDays: { type: 'number' },
        indicators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              title: { type: 'string' },
              insight: { type: 'string' },
              metric: { type: 'string' },
              severity: { type: 'string' },
              suggestedAction: { type: 'string' },
              actionLabel: { type: 'string' },
              actionHref: { type: 'string' },
              items: { type: 'array' },
              detectedAt: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getActionableIndicators(@Query() dto: ActionableIndicatorsDto) {
    return this.reportsService.getActionableIndicators(dto);
  }

  @Get('dashboard-summary')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Resumen del dashboard en lenguaje natural (IA Fase 3)',
    description:
      'Una o dos frases que resumen los indicadores accionables. Si OPENAI_API_KEY está configurado, usa LLM (gpt-4o-mini); si no, devuelve fallback con los primeros insights.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Días hacia atrás (igual que actionable-indicators)',
  })
  @ApiQuery({
    name: 'top',
    required: false,
    description: 'Máximo ítems por indicador',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen en texto',
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Resumen en una o dos frases' },
        source: { type: 'string', enum: ['llm', 'fallback'] },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getDashboardSummary(@Query() dto: ActionableIndicatorsDto) {
    return this.reportsService.getDashboardSummary(dto);
  }

  @Get('customer-clusters')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Clustering de clientes (K-means)',
    description:
      'Segmenta clientes con ventas en el periodo usando K-means (monto total, días desde última compra, cantidad de compras). Devuelve k clusters con lista de clientes por segmento.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Días hacia atrás (30-365)',
    default: 90,
  })
  @ApiQuery({
    name: 'k',
    required: false,
    description: 'Número de clusters (2-10)',
    default: 3,
  })
  @ApiResponse({
    status: 200,
    description: 'Clusters de clientes',
    schema: {
      type: 'object',
      properties: {
        periodDays: { type: 'number' },
        k: { type: 'number' },
        clusters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              clusterIndex: { type: 'number' },
              label: { type: 'string' },
              customers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getCustomerClusters(@Query() dto: CustomerClustersDto) {
    return this.reportsService.getCustomerClusters(dto);
  }

  @Get('operational-state')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Estado operativo del negocio',
    description:
      'Indicadores por área (caja, inventario, cotizaciones, ventas, facturas proveedor) y alertas con acción sugerida. Para construir dashboard "Acciones recomendadas".',
  })
  @ApiResponse({
    status: 200,
    description: 'Indicadores y alertas',
    schema: {
      type: 'object',
      properties: {
        indicators: { type: 'object' },
        alerts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              severity: {
                type: 'string',
                enum: ['critical', 'high', 'medium', 'low', 'info'],
              },
              priority: { type: 'number' },
              title: { type: 'string' },
              message: { type: 'string' },
              area: { type: 'string' },
              count: { type: 'number' },
              actionLabel: { type: 'string' },
              actionHref: { type: 'string' },
              entityIds: { type: 'array', items: { type: 'string' } },
              detectedAt: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getOperationalState() {
    return this.reportsService.getOperationalState();
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
