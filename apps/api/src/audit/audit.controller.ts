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
} from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { AuditService } from '../common/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ModulesGuard } from '../auth/modules.guard';
import { RequireModule } from '../auth/require-module.decorator';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@ApiTags('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard, ModulesGuard)
@RequirePermission('audit:read')
@RequireModule('audit')
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
  async list(@Query() query: ListAuditLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.entity?.trim()) where.entity = query.entity.trim();
    if (query.action?.trim()) where.action = query.action.trim();
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { entityId: { contains: search, mode: 'insensitive' } },
        { actor: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, email: true, role: true } } },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
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

  @Get('verify-chain')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Verificar cadena de integridad',
    description:
      'Comprueba que la cadena de hashes de los logs de auditoría no ha sido alterada (inmutabilidad).',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la verificación',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        totalChecked: { type: 'number' },
        totalWithHash: { type: 'number' },
        brokenAt: { type: 'string', nullable: true },
        errors: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  async verifyChain() {
    return this.audit.verifyChain();
  }

  @Get('entity/:entity/:entityId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener logs de una entidad específica',
    description:
      'Obtiene todos los logs de auditoría de una entidad específica (requiere ADMIN)',
  })
  @ApiParam({
    name: 'entity',
    description: 'Tipo de entidad (product, customer, sale, etc.)',
  })
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
