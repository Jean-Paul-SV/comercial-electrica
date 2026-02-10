import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { DianService } from './dian.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ModulesGuard } from '../auth/modules.guard';
import { RequireModule } from '../auth/require-module.decorator';

@ApiTags('dian')
@UseGuards(JwtAuthGuard, PermissionsGuard, ModulesGuard)
@RequirePermission('dian:manage')
@RequireModule('electronic_invoicing')
@Controller('dian')
export class DianController {
  constructor(private readonly dianService: DianService) {}

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
