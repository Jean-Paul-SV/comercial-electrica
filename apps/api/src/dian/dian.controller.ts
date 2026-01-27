import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { DianService } from './dian.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('dian')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
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
  async getDocumentStatus(@Param('id') id: string) {
    const status = await this.dianService.queryDocumentStatus(id);
    
    // Obtener información adicional del documento
    const doc = await this.dianService['prisma'].dianDocument.findUnique({
      where: { id },
      select: {
        status: true,
        cufe: true,
        sentAt: true,
        lastError: true,
      },
    });

    return {
      status,
      cufe: doc?.cufe || null,
      sentAt: doc?.sentAt || null,
      lastError: doc?.lastError || null,
    };
  }
}
