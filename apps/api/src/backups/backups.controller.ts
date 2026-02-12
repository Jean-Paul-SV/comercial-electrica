import {
  Controller,
  Get,
  Post,
  Delete,
  ParseUUIDPipe,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { BackupsService } from './backups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ModulesGuard } from '../auth/modules.guard';
import { RequireModule } from '../auth/require-module.decorator';

@ApiTags('backups')
@UseGuards(JwtAuthGuard, PermissionsGuard, ModulesGuard)
@RequirePermission('backups:manage')
@RequireModule('backups')
@Controller('backups')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear backup',
    description:
      'Crea un backup de la base de datos. Cada admin de tenant puede generar backups de su empresa; solo plataforma puede descargar el archivo.',
  })
  @ApiResponse({ status: 201, description: 'Backup creado exitosamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  create(@Req() req: { user?: { tenantId?: string | null } }) {
    return this.backups.createBackup(req.user?.tenantId ?? undefined);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar backups',
    description: 'Lista los backups del tenant del usuario (o todos si es admin de plataforma).',
  })
  @ApiResponse({ status: 200, description: 'Lista de backups' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  list(@Req() req: { user?: { tenantId?: string | null } }) {
    return this.backups.listBackups(req.user?.tenantId ?? undefined);
  }

  @Get(':id/download')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Descargar archivo de backup',
    description:
      'Solo administradores de plataforma pueden descargar el archivo. Los admins de tenant pueden crear y ver sus backups pero no descargar.',
  })
  @ApiParam({ name: 'id', description: 'ID del backup' })
  @ApiResponse({
    status: 200,
    description: 'Archivo del backup',
    content: { 'application/octet-stream': {} },
  })
  @ApiResponse({
    status: 404,
    description: 'Backup no encontrado o no disponible',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Solo administradores de plataforma pueden descargar' })
  async download(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { tenantId?: string | null } },
  ): Promise<StreamableFile> {
    const { filePath, fileName } = await this.backups.getBackupDownload(
      id,
      req.user?.tenantId ?? undefined,
    );
    const stream = createReadStream(filePath);
    return new StreamableFile(stream, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener backup por ID',
    description: 'Obtiene los detalles de un backup (del tenant del usuario o cualquiera si es plataforma).',
  })
  @ApiParam({ name: 'id', description: 'ID del backup' })
  @ApiResponse({ status: 200, description: 'Backup encontrado' })
  @ApiResponse({ status: 404, description: 'Backup no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    return this.backups.getBackup(id, req.user?.tenantId ?? undefined);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Verificar integridad de backup',
    description: 'Verifica que el backup no esté corrupto (solo del propio tenant si no es plataforma).',
  })
  @ApiParam({ name: 'id', description: 'ID del backup' })
  @ApiResponse({ status: 200, description: 'Backup verificado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  verify(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    return this.backups.verifyBackup(id, req.user?.tenantId ?? undefined).then((isValid: boolean) => ({
      id,
      isValid,
    }));
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Eliminar backup',
    description: 'Elimina un backup (solo del propio tenant si no es plataforma).',
  })
  @ApiParam({ name: 'id', description: 'ID del backup' })
  @ApiResponse({ status: 200, description: 'Backup eliminado' })
  @ApiResponse({ status: 404, description: 'Backup no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { sub?: string; tenantId?: string | null } },
  ) {
    return this.backups.deleteBackup(id, req.user?.sub, req.user?.tenantId ?? undefined);
  }
}
