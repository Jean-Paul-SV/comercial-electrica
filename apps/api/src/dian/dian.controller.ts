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
} from '@nestjs/common';
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
  constructor(private readonly dianService: DianService) {}

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
    description: 'Crea o actualiza los datos de facturación electrónica (emisor, software ID/PIN, numeración).',
  })
  @ApiBody({ type: UpdateDianConfigDto })
  @ApiResponse({ status: 200, description: 'Configuración actualizada' })
  async updateConfig(
    @Req() req: { user?: { tenantId?: string } },
    @Body() dto: UpdateDianConfigDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.dianService.upsertDianConfig(tenantId, dto);
  }

  @Post('config/certificate')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Subir certificado .p12 del tenant',
    description:
      'Sube el certificado de firma electrónica (.p12 en base64) y su contraseña. Se almacenan cifrados.',
  })
  @ApiBody({ type: UploadCertificateDto })
  @ApiResponse({ status: 201, description: 'Certificado guardado' })
  @ApiResponse({ status: 400, description: 'certBase64 o contraseña inválidos' })
  async uploadCertificate(
    @Req() req: { user?: { tenantId?: string } },
    @Body() dto: UploadCertificateDto,
  ) {
    const tenantId = this.getTenantId(req);
    await this.dianService.saveCertificate(
      tenantId,
      dto.certBase64,
      dto.password,
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
      },
    },
  })
  async getConfigStatus(@Req() req: { user?: { tenantId?: string } }) {
    const tenantId = req?.user?.tenantId;
    if (tenantId) {
      return this.dianService.getConfigStatusForTenant(tenantId);
    }
    return this.dianService.getConfigStatus();
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
}
