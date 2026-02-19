import {
  Controller,
  Get,
  Query,
  UseGuards,
  StreamableFile,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
import { SalesReportDto } from './dto/sales-report.dto';
import { InventoryReportDto } from './dto/inventory-report.dto';
import { CashReportDto } from './dto/cash-report.dto';
import { CustomersReportDto } from './dto/customers-report.dto';
import { ExportReportDto } from './dto/export-report.dto';
import { ActionableIndicatorsDto } from './dto/actionable-indicators.dto';
import { CustomerClustersDto } from './dto/customer-clusters.dto';
import { TrendingProductsDto } from './dto/trending-products.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { RequireModule } from '../auth/require-module.decorator';

@ApiTags('reports')
@UseGuards(JwtAuthGuard, ModulesGuard)
@RequireModule('advanced_reports')
@Throttle({ reports: { limit: 30, ttl: 60000 } }) // 30 requests por minuto por usuario para todos los reportes
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reporte de ventas',
    description:
      'Obtiene un reporte detallado de ventas filtrado por tenant con filtros opcionales por fecha y cliente. Incluye totales y estadísticas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de ventas generado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  getSalesReport(
    @Query() dto: SalesReportDto,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para obtener el reporte de ventas',
      );
    }
    return this.reportsService.getSalesReport(dto, tenantId);
  }

  @Get('inventory')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reporte de inventario',
    description:
      'Obtiene un reporte del estado del inventario filtrado por tenant. Puede filtrar por stock bajo y categoría.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de inventario generado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  getInventoryReport(
    @Query() dto: InventoryReportDto,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para obtener el reporte de inventario',
      );
    }
    return this.reportsService.getInventoryReport(dto, tenantId);
  }

  @Get('cash')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reporte de caja',
    description:
      'Obtiene un reporte de sesiones de caja filtrado por tenant, con movimientos y diferencias. Puede filtrar por sesión o rango de fechas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de caja generado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  getCashReport(
    @Query() dto: CashReportDto,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para obtener el reporte de caja',
      );
    }
    return this.reportsService.getCashReport(dto, tenantId);
  }

  @Get('customers')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reporte de clientes',
    description:
      'Obtiene un reporte de los mejores clientes filtrado por tenant, basado en ventas. Puede filtrar por período y limitar resultados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte de clientes generado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  getCustomersReport(
    @Query() dto: CustomersReportDto,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para obtener el reporte de clientes',
      );
    }
    return this.reportsService.getCustomersReport(dto, tenantId);
  }

  @Throttle({ export: { limit: 10, ttl: 60000 } }) // 10 exports por minuto por usuario (más restrictivo)
  @Get('export')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Exportar datos a CSV',
    description:
      'Exporta ventas o clientes a CSV para descarga. Útil para respaldo o trabajar sin conexión estable. Límite: 10 exports por minuto por usuario.',
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
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  async export(
    @Query() dto: ExportReportDto,
    @Req() req: { user?: { tenantId?: string | null } },
  ): Promise<StreamableFile> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant requerido para exportar datos');
    }
    const { csv, fileName } = await this.reportsService.exportAsCsv(
      dto,
      tenantId,
    );
    return new StreamableFile(Buffer.from(csv, 'utf-8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @RequireModule()
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
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  getActionableIndicators(
    @Query() dto: ActionableIndicatorsDto,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para indicadores accionables',
      );
    }
    return this.reportsService.getActionableIndicators(dto, tenantId);
  }

  @RequireModule('ai')
  @Get('dashboard-summary')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Resumen del dashboard en lenguaje natural (IA)',
    description:
      'Requiere módulo "ai" (planes Premium y Enterprise). Una o dos frases que resumen los indicadores. Si OPENAI_API_KEY está configurado usa LLM; si no, fallback con los primeros insights.',
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
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  getDashboardSummary(
    @Query() dto: ActionableIndicatorsDto,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para el resumen del dashboard',
      );
    }
    return this.reportsService.getDashboardSummary(dto, tenantId);
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
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  getCustomerClusters(
    @Query() dto: CustomerClustersDto,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para clustering de clientes',
      );
    }
    return this.reportsService.getCustomerClusters(dto, tenantId);
  }

  @RequireModule()
  @Get('trending-products')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Artículos en tendencias',
    description:
      'Productos ordenados por ingreso total (ventas pagadas) en el período. Incluye ingreso, cantidad vendida y número de ventas.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Días hacia atrás (1-365)',
    default: 30,
  })
  @ApiQuery({
    name: 'top',
    required: false,
    description: 'Cantidad máxima de artículos (1-100)',
    default: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de artículos en tendencia por ingreso',
    schema: {
      type: 'object',
      properties: {
        periodDays: { type: 'number' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  internalCode: { type: 'string' },
                  name: { type: 'string' },
                  category: { type: 'object' },
                  price: { type: 'number' },
                },
              },
              totalRevenue: { type: 'number' },
              totalQty: { type: 'number' },
              salesCount: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  getTrendingProducts(
    @Query() dto: TrendingProductsDto,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para productos en tendencia',
      );
    }
    return this.reportsService.getTrendingProducts(dto, tenantId);
  }

  @RequireModule()
  @Get('operational-state')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Estado operativo del negocio',
    description:
      'Indicadores por área (caja, inventario, cotizaciones, ventas, facturas proveedor) filtrados por tenant y alertas con acción sugerida. Para construir dashboard "Acciones recomendadas".',
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
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  getOperationalState(@Req() req: { user?: { tenantId?: string | null } }) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para obtener el estado operativo',
      );
    }
    return this.reportsService.getOperationalState(tenantId);
  }

  @RequireModule()
  @Get('dashboard')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Dashboard ejecutivo',
    description:
      'Obtiene KPIs principales del sistema filtrados por tenant: ventas del día, productos con stock bajo, sesiones de caja abiertas, cotizaciones pendientes, etc. Opcionalmente lowStockThreshold (por defecto 10) para el umbral de stock bajo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard generado exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Tenant requerido' })
  getDashboard(
    @Req() req: { user?: { tenantId?: string | null } },
    @Query('lowStockThreshold') lowStockThreshold?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para obtener el dashboard',
      );
    }
    const threshold =
      lowStockThreshold != null && lowStockThreshold !== ''
        ? parseInt(lowStockThreshold, 10)
        : undefined;
    if (threshold !== undefined && (Number.isNaN(threshold) || threshold < 0)) {
      // ignorar valor inválido y usar defecto
    }
    const safeThreshold =
      threshold !== undefined && !Number.isNaN(threshold) && threshold >= 0
        ? threshold
        : undefined;
    return this.reportsService.getDashboard(tenantId, safeThreshold);
  }
}
