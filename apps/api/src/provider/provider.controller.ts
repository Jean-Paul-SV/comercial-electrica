import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { ProviderService } from './provider.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@ApiTags('provider')
@ApiBearerAuth()
@Controller('provider')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class ProviderController {
  constructor(private readonly provider: ProviderService) {}

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
}
