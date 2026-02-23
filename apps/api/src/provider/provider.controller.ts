import {
  Body,
  Controller,
  Delete,
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
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { ProviderService } from './provider.service';
import { DianService } from '../dian/dian.service';
import { FeedbackService } from '../feedback/feedback.service';
import { UpdateFeedbackStatusDto } from '../feedback/dto/update-feedback-status.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import {
  UpdateDianConfigDto,
  UploadCertificateDto,
} from '../dian/dto/dian-config.dto';
import { UsageService } from '../usage/usage.service';
import { ListUsageQueryDto } from '../usage/dto/list-usage-query.dto';
import { UsageByDayQueryDto } from '../usage/dto/usage-by-day-query.dto';
import { BackupsService } from '../backups/backups.service';
import { BusinessMetricsService } from '../metrics/business-metrics.service';

@ApiTags('provider')
@ApiBearerAuth()
@Controller('provider')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class ProviderController {
  constructor(
    private readonly provider: ProviderService,
    private readonly dianService: DianService,
    private readonly feedbackService: FeedbackService,
    private readonly usageService: UsageService,
    private readonly backupsService: BackupsService,
    private readonly businessMetrics: BusinessMetricsService,
  ) {}

  @Get('tenants/summary')
  @ApiOperation({
    summary: 'Resumen de tenants para panel proveedor',
    description:
      'Devuelve métricas agregadas (nº de empresas, usuarios, uso por plan y por módulo). No incluye datos personales.',
  })
  @ApiResponse({ status: 200, description: 'Resumen calculado correctamente.' })
  getTenantsSummary() {
    return this.provider.getTenantsSummary();
  }

  @Get('usage/events/by-day')
  @ApiOperation({
    summary: 'Eventos de uso agregados por día',
    description:
      'Para gráficos de picos (panel proveedor). Devuelve { date, count }[]. Si no se envían from/to se usan los últimos 30 días.',
  })
  @ApiResponse({ status: 200, description: 'Lista de fechas con conteo de eventos.' })
  listUsageEventsByDay(@Query() query: UsageByDayQueryDto) {
    return this.usageService.listByDay({
      tenantId: query.tenantId,
      event: query.event,
      from: query.from,
      to: query.to,
    });
  }

  @Get('usage/events')
  @ApiOperation({
    summary: 'Listar eventos de uso',
    description:
      'Eventos de uso para mejorar el producto (screen_view, sale_created, etc.). Solo admin de plataforma.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de eventos.' })
  listUsageEvents(@Query() query: ListUsageQueryDto) {
    return this.usageService.list({
      tenantId: query.tenantId,
      event: query.event,
      from: query.from,
      to: query.to,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('analytics/page-visits')
  @ApiOperation({
    summary: 'Contador de visitas por empresa y por página',
    description:
      'Devuelve total universal, visitas por tenant y por ruta (path). Opcional: from/to en ISO para filtrar por fecha.',
  })
  @ApiResponse({ status: 200, description: 'Datos de visitas.' })
  getPageVisitsAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.provider.getPageVisitsAnalytics({ from, to });
  }

  @Get('plans')
  @ApiOperation({
    summary: 'Listar planes',
    description:
      'Planes. Con activeOnly=true solo activos (para dropdowns). Sin parámetro devuelve todos (gestión).',
  })
  @ApiResponse({ status: 200, description: 'Lista de planes.' })
  listPlans(@Query('activeOnly') activeOnly?: string) {
    return this.provider.listPlans(activeOnly === 'true');
  }

  @Post('plans')
  @ApiOperation({
    summary: 'Crear plan',
    description:
      'Crea un plan con todos los módulos por defecto. El slug debe ser único.',
  })
  @ApiResponse({ status: 201, description: 'Plan creado.' })
  @ApiResponse({ status: 409, description: 'Ya existe un plan con ese slug.' })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.provider.createPlan(dto);
  }

  @Patch('plans/:id')
  @ApiOperation({
    summary: 'Actualizar plan',
    description:
      'Actualiza nombre, descripción, precios, stripePriceId o isActive.',
  })
  @ApiResponse({ status: 200, description: 'Plan actualizado.' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado.' })
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.provider.updatePlan(id, dto);
  }

  @Get('tenants')
  @ApiOperation({
    summary: 'Listar tenants (empresas)',
    description:
      'Solo administradores de plataforma (usuarios sin tenant). Incluye conteo de usuarios y última actividad.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de tenants.' })
  listTenants(@Query() query: ListTenantsQueryDto) {
    return this.provider.listTenants(query);
  }

  @Get('tenants/:id')
  @ApiOperation({
    summary: 'Detalle de un tenant',
    description: 'Incluye conteos (usuarios, productos, ventas, clientes).',
  })
  @ApiResponse({ status: 200, description: 'Tenant encontrado.' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado.' })
  getTenant(@Param('id') id: string) {
    return this.provider.getTenant(id);
  }

  @Patch('tenants/:id/status')
  @ApiOperation({
    summary: 'Suspender o reactivar tenant',
    description:
      'isActive: false = suspender (los usuarios no podrán hacer login). true = reactivar.',
  })
  @ApiResponse({ status: 200, description: 'Estado actualizado.' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado.' })
  updateTenantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.provider.updateTenantStatus(id, dto);
  }

  @Delete('tenants/:id')
  @ApiOperation({
    summary: 'Eliminar empresa (tenant)',
    description:
      'Elimina la empresa y todos sus datos. Desactiva los usuarios asociados. No se puede deshacer.',
  })
  @ApiResponse({ status: 200, description: 'Empresa eliminada.' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado.' })
  deleteTenant(@Param('id') id: string) {
    return this.provider.deleteTenant(id);
  }

  @Patch('tenants/:id')
  @ApiOperation({
    summary: 'Actualizar tenant (plan)',
    description:
      'Actualiza el plan del tenant y su suscripción. Si no tenía suscripción, se crea.',
  })
  @ApiResponse({ status: 200, description: 'Tenant actualizado.' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado.' })
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.provider.updateTenant(id, dto);
  }

  @Patch('tenants/:id/subscription/renew')
  @ApiOperation({
    summary: 'Renovar periodo de suscripción',
    description:
      'Extiende el periodo (currentPeriodEnd) de la suscripción. Por defecto 30 días desde el fin del periodo actual o desde hoy.',
  })
  @ApiResponse({ status: 200, description: 'Suscripción renovada.' })
  @ApiResponse({ status: 404, description: 'Tenant sin suscripción.' })
  renewSubscription(
    @Param('id') id: string,
    @Body() dto: RenewSubscriptionDto,
  ) {
    return this.provider.renewSubscription(id, dto);
  }

  @Post('tenants')
  @ApiOperation({
    summary: 'Crear tenant y primer usuario administrador',
    description:
      'Alta de nueva empresa (tenant) y su primer admin. Si no se envía adminPassword se genera contraseña temporal (cambio obligatorio en primer login). En desarrollo se devuelve la contraseña temporal.',
  })
  @ApiResponse({ status: 201, description: 'Tenant y admin creados.' })
  @ApiResponse({ status: 409, description: 'Slug o email ya existente.' })
  createTenant(@Body() dto: CreateTenantDto) {
    return this.provider.createTenant(dto);
  }

  @Get('tenants/:tenantId/dian-config')
  @ApiOperation({
    summary: 'Configuración DIAN de una empresa (proveedor)',
    description:
      'Obtiene la configuración de facturación electrónica de la empresa indicada. Solo administrador de plataforma.',
  })
  @ApiParam({ name: 'tenantId', description: 'ID del tenant (empresa)' })
  @ApiResponse({ status: 200, description: 'Configuración o null.' })
  getTenantDianConfig(@Param('tenantId') tenantId: string) {
    return this.dianService.getDianConfigForTenant(tenantId);
  }

  @Get('tenants/:tenantId/dian-config-status')
  @ApiOperation({
    summary: 'Estado de configuración DIAN de una empresa (proveedor)',
    description:
      'Indica si está lista para facturar y qué falta. Solo administrador de plataforma.',
  })
  @ApiParam({ name: 'tenantId', description: 'ID del tenant (empresa)' })
  @ApiResponse({ status: 200, description: 'Estado de la configuración.' })
  getTenantDianConfigStatus(@Param('tenantId') tenantId: string) {
    return this.dianService.getConfigStatusForTenant(tenantId);
  }

  @Patch('tenants/:tenantId/dian-config')
  @ApiOperation({
    summary: 'Actualizar configuración DIAN de una empresa (proveedor)',
    description:
      'Crea o actualiza datos de facturación electrónica de la empresa. Solo administrador de plataforma.',
  })
  @ApiParam({ name: 'tenantId', description: 'ID del tenant (empresa)' })
  @ApiBody({ type: UpdateDianConfigDto })
  @ApiResponse({ status: 200, description: 'Configuración actualizada.' })
  updateTenantDianConfig(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateDianConfigDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.dianService.upsertDianConfig(
      tenantId,
      dto,
      req.user?.sub ?? null,
    );
  }

  @Post('tenants/:tenantId/dian-config/certificate')
  @ApiOperation({
    summary: 'Subir certificado .p12 de una empresa (proveedor)',
    description:
      'Sube el certificado de firma electrónica de la empresa. Solo administrador de plataforma.',
  })
  @ApiParam({ name: 'tenantId', description: 'ID del tenant (empresa)' })
  @ApiBody({ type: UploadCertificateDto })
  @ApiResponse({ status: 201, description: 'Certificado guardado.' })
  uploadTenantDianCertificate(
    @Param('tenantId') tenantId: string,
    @Body() dto: UploadCertificateDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.dianService
      .saveCertificate(
        tenantId,
        dto.certBase64,
        dto.password,
        req.user?.sub ?? null,
      )
      .then(() => ({
        ok: true,
        message: 'Certificado guardado correctamente.',
      }));
  }

  @Get('feedback')
  @ApiOperation({
    summary: 'Listar sugerencias de mejoras de los clientes',
    description:
      'Todas las sugerencias enviadas por usuarios de los tenants (excluye solicitudes de activación DIAN, que se gestionan en Solicitudes DIAN). Opcional: ?tenantId=... y ?status=PENDING|READ|DONE.',
  })
  @ApiResponse({ status: 200, description: 'Lista de sugerencias.' })
  listFeedback(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: 'PENDING' | 'READ' | 'DONE',
  ) {
    return this.feedbackService.findAll(tenantId, status, true);
  }

  @Patch('feedback/:id')
  @ApiOperation({
    summary: 'Actualizar estado de una sugerencia',
    description: 'Marcar como leída o resuelta.',
  })
  @ApiResponse({ status: 200, description: 'Estado actualizado.' })
  @ApiResponse({ status: 404, description: 'Sugerencia no encontrada.' })
  updateFeedbackStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackStatusDto,
  ) {
    return this.feedbackService.updateStatus(id, dto.status);
  }

  @Get('dian-activations')
  @ApiOperation({
    summary: 'Listar solicitudes de activación DIAN pendientes',
    description:
      'Empresas que cambiaron a un plan con DIAN pero aún no han activado el servicio (pendiente de pago y configuración).',
  })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes pendientes.' })
  listDianActivationRequests() {
    return this.provider.listDianActivationRequests();
  }

  @Patch('tenants/:id/dian-activation/complete')
  @ApiOperation({
    summary: 'Marcar activación DIAN como completada',
    description:
      'Después de cobrar el costo de activación ($300.000) y configurar el servicio, marca la activación como completada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Activación marcada como completada.',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuración DIAN no encontrada.',
  })
  @ApiResponse({
    status: 400,
    description: 'La activación ya está completada.',
  })
  markDianActivationAsCompleted(@Param('id') tenantId: string) {
    return this.provider.markDianActivationAsCompleted(tenantId);
  }

  @Get('backups')
  @ApiOperation({
    summary: 'Listar backups con metadatos (panel proveedor)',
    description:
      'Lista backups recientes con información del tenant y estadísticas básicas. Solo metadatos, sin acceso al contenido.',
  })
  @ApiResponse({ status: 200, description: 'Lista de backups con metadatos.' })
  listBackups(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.backupsService.listBackupsForProvider(limitNum);
  }

  @Get('backups/statistics')
  @ApiOperation({
    summary: 'Estadísticas agregadas de backups',
    description:
      'Métricas de adopción, éxito, tamaños promedio, etc. Útil para monitoreo y análisis del producto.',
  })
  @ApiResponse({ status: 200, description: 'Estadísticas calculadas.' })
  getBackupsStatistics() {
    return this.backupsService.getBackupsStatistics();
  }

  @Get('backups/alerts')
  @ApiOperation({
    summary: 'Alertas de backups',
    description:
      'Backups fallidos recientes, tamaños anormales, uso excesivo, etc. Para detectar problemas técnicos.',
  })
  @ApiResponse({ status: 200, description: 'Lista de alertas.' })
  getBackupsAlerts() {
    return this.backupsService.getBackupsAlerts();
  }

  @Get('metrics/business')
  @ApiOperation({
    summary: 'Métricas de negocio (MRR, churn, LTV, CAC)',
    description:
      'C3.1: Métricas críticas requeridas por comité de inversión. Incluye MRR, churn rate, LTV, CAC, conversión y ARPU.',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas de negocio calculadas.',
  })
  getBusinessMetrics() {
    return this.businessMetrics.calculateBusinessMetrics();
  }
}
