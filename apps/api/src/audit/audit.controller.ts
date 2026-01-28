import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
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
import { AuditService } from '../common/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar logs de auditoría',
    description: 'Obtiene todos los logs de auditoría (requiere ADMIN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de logs de auditoría',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
            hasNextPage: { type: 'boolean' },
            hasPreviousPage: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  async list(@Query() pagination?: PaginationDto) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, email: true, role: true } } },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  @Get('entity/:entity/:entityId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener logs de una entidad específica',
    description: 'Obtiene todos los logs de auditoría de una entidad específica (requiere ADMIN)',
  })
  @ApiParam({ name: 'entity', description: 'Tipo de entidad (product, customer, sale, etc.)' })
  @ApiParam({ name: 'entityId', description: 'ID de la entidad' })
  @ApiResponse({
    status: 200,
    description: 'Lista de logs de la entidad',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  async getEntityLogs(
    @Param('entity') entity: string,
    @Param('entityId', new ParseUUIDPipe({ version: '4' })) entityId: string,
  ) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entity,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, email: true, role: true } } },
    });

    return { entity, entityId, logs };
  }
}
