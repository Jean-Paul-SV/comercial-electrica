import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Body,
  UseGuards,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { DianService } from './dian.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ModulesGuard } from '../auth/modules.guard';
import { RequireModule } from '../auth/require-module.decorator';
import { PermissionsService } from '../auth/permissions.service';
import {
  UpdateDianConfigDto,
  UploadCertificateDto,
} from './dto/dian-config.dto';

@ApiTags('dian')
@UseGuards(JwtAuthGuard, PermissionsGuard, ModulesGuard)
@RequirePermission('dian:manage')
@RequireModule('electronic_invoicing')
@Controller('dian')
export class DianController {
  private readonly logger = new Logger(DianController.name);

  constructor(
    private readonly dianService: DianService,
    private readonly permissions: PermissionsService,
    @InjectQueue('dian') private readonly dianQueue: Queue,
  ) {}

  private getTenantId(req: { user?: { tenantId?: string } }): string {
    const tenantId = req?.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para configurar facturación electrónica.',
      );
    }
    return tenantId;
  }

  @Get('config')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Configuración DIAN del tenant',
    description:
      'Obtiene la configuración de facturación electrónica de la empresa (sin secretos).',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración o null si no existe',
  })
  async getConfig(@Req() req: { user?: { tenantId?: string } }) {
    const tenantId = this.getTenantId(req);
    return this.dianService.getDianConfigForTenant(tenantId);
  }

  @Patch('config')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar configuración DIAN del tenant',
    description:
      'Crea o actualiza los datos de facturación electrónica (emisor, software ID/PIN, numeración).',
  })
  @ApiBody({ type: UpdateDianConfigDto })
  @ApiResponse({ status: 200, description: 'Configuración actualizada' })
  async updateConfig(
    @Req() req: { user?: { tenantId?: string; sub?: string } },
    @Body() dto: UpdateDianConfigDto,
  ) {
    const tenantId = this.getTenantId(req);
    const sensitive =
      dto.resolutionNumber !== undefined ||
      dto.prefix !== undefined ||
      dto.rangeFrom !== undefined ||
      dto.rangeTo !== undefined ||
      dto.softwarePin !== undefined;
    if (sensitive && req.user?.sub) {
      const canManageCert = await this.permissions.userHasAnyPermission(
        req.user.sub,
        ['dian:manage_certificate'],
      );
      if (!canManageCert) {
        throw new ForbiddenException(
          'Se requiere permiso de gestión de certificado (dian:manage_certificate) para modificar numeración o PIN.',
        );
      }
    }
    return this.dianService.upsertDianConfig(
      tenantId,
      dto,
      req.user?.sub ?? null,
    );
  }

  @Post('config/certificate')
  @RequirePermission('dian:manage_certificate')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Subir certificado .p12 del tenant',
    description:
      'Sube el certificado de firma electrónica (.p12 en base64) y su contraseña. Se almacenan cifrados. Requiere permiso dian:manage_certificate.',
  })
  @ApiBody({ type: UploadCertificateDto })
  @ApiResponse({ status: 201, description: 'Certificado guardado' })
  @ApiResponse({
    status: 400,
    description: 'certBase64 o contraseña inválidos',
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permiso dian:manage_certificate',
  })
  async uploadCertificate(
    @Req() req: { user?: { tenantId?: string; sub?: string } },
    @Body() dto: UploadCertificateDto,
  ) {
    const tenantId = this.getTenantId(req);
    await this.dianService.saveCertificate(
      tenantId,
      dto.certBase64,
      dto.password,
      req.user?.sub ?? null,
    );
    return { ok: true, message: 'Certificado guardado correctamente.' };
  }

  @Get('config-status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Estado de configuración DIAN',
    description:
      'Indica si la configuración del tenant está lista para envío real y qué falta (sin revelar secretos).',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de la configuración',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: [
            'not_configured',
            'incomplete',
            'cert_expired',
            'range_exhausted',
            'ready',
          ],
        },
        readyForSend: { type: 'boolean' },
        missing: { type: 'array', items: { type: 'string' } },
        hasCert: { type: 'boolean' },
        hasIssuerData: { type: 'boolean' },
        env: { type: 'string', enum: ['HABILITACION', 'PRODUCCION'] },
        certValidUntil: { type: 'string', format: 'date-time', nullable: true },
        nextNumber: { type: 'number', nullable: true },
        rangeTo: { type: 'number', nullable: true },
        certExpiresInDays: {
          type: 'number',
          nullable: true,
          description:
            'Días hasta vencimiento del certificado (solo cuando ready)',
        },
        rangeRemaining: {
          type: 'number',
          nullable: true,
          description:
            'Números restantes en el rango autorizado (solo cuando ready)',
        },
      },
    },
  })
  async getConfigStatus(@Req() req: { user?: { tenantId?: string; id?: string } }) {
    const tenantId = req?.user?.tenantId;
    const userId = req?.user?.id || 'unknown';
    this.logger.log(`[getConfigStatus] Request recibido - userId: ${userId}, tenantId: ${tenantId || 'null'}`);
    
    if (!tenantId) {
      this.logger.warn(`[getConfigStatus] Usuario sin tenantId - userId: ${userId}. Esto causará 403 si el usuario no es platform admin.`);
      // El guard ya debería haber rechazado esto, pero por si acaso
      throw new ForbiddenException(
        'Tenant requerido para consultar estado de configuración DIAN.',
      );
    }
    
    try {
      this.logger.log(`[getConfigStatus] Obteniendo estado para tenant ${tenantId}`);
      const result = await this.dianService.getConfigStatusForTenant(tenantId);
      this.logger.log(`[getConfigStatus] Estado obtenido exitosamente para tenant ${tenantId}`);
      return result;
    } catch (error) {
      this.logger.error(`[getConfigStatus] Error al obtener estado para tenant ${tenantId}:`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  @Get('documents/:id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Consultar estado de documento DIAN',
    description: 'Consulta el estado actual de un documento DIAN en el sistema',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del documento DIAN',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del documento consultado exitosamente',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['DRAFT', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'ERROR'],
          example: 'ACCEPTED',
        },
        cufe: {
          type: 'string',
          nullable: true,
          example: 'CUFE-12345678-1234567890',
        },
        sentAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
        },
        lastError: {
          type: 'string',
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Documento DIAN no encontrado',
  })
  async getDocumentStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { tenantId?: string } },
  ) {
    const result = await this.dianService.getDocumentStatusForTenant(
      id,
      req?.user?.tenantId,
    );

    return result;
  }

  @Post('documents/:id/process')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Procesar documento DIAN (pruebas)',
    description:
      'Ejecuta el procesamiento completo del documento: XML con CUFE, firma, envío a DIAN (o simulado), generación de PDF. Útil para probar sin esperar al worker de la cola.',
  })
  @ApiParam({ name: 'id', description: 'UUID del documento DIAN' })
  @ApiResponse({
    status: 200,
    description: 'Procesamiento iniciado/completado',
  })
  @ApiResponse({
    status: 403,
    description: 'No autorizado para este documento',
  })
  @ApiResponse({ status: 404, description: 'Documento no encontrado' })
  async processDocument(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { tenantId?: string } },
  ) {
    const tenantId = req?.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant requerido.');
    }
    await this.dianService.processDocumentIfBelongsToTenant(id, tenantId);
    return {
      message: 'Documento procesado.',
      dianDocumentId: id,
    };
  }

  @Post('documents/retry-pending')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reintentar envíos DIAN pendientes',
    description:
      'Reencola todos los documentos del tenant en estado DRAFT o REJECTED para que el worker los procese de nuevo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Documentos encolados',
    schema: {
      type: 'object',
      properties: {
        enqueued: {
          type: 'number',
          description: 'Cantidad de documentos encolados',
        },
        message: { type: 'string' },
      },
    },
  })
  async retryPendingDocuments(@Req() req: { user?: { tenantId?: string } }) {
    const tenantId = this.getTenantId(req);
    const ids = await this.dianService.getPendingDocumentIds(tenantId);
    for (const dianDocumentId of ids) {
      await this.dianQueue.add(
        'send',
        { dianDocumentId },
        { attempts: 10, backoff: { type: 'exponential', delay: 5000 } },
      );
    }
    return {
      enqueued: ids.length,
      message:
        ids.length === 0
          ? 'No hay documentos pendientes de reenvío.'
          : `Se encolaron ${ids.length} documento(s) para reenvío.`,
    };
  }
}
