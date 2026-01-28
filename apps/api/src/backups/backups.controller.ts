import {
  Controller,
  Get,
  Post,
  Delete,
  ParseUUIDPipe,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BackupsService } from './backups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMIN)
@Controller('backups')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear backup',
    description: 'Crea un backup de la base de datos (requiere ADMIN)',
  })
  @ApiResponse({ status: 201, description: 'Backup creado exitosamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  create() {
    return this.backups.createBackup();
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar backups',
    description: 'Obtiene todos los backups (requiere ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'Lista de backups' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  list() {
    return this.backups.listBackups();
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener backup por ID',
    description: 'Obtiene los detalles de un backup (requiere ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID del backup' })
  @ApiResponse({ status: 200, description: 'Backup encontrado' })
  @ApiResponse({ status: 404, description: 'Backup no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.backups.getBackup(id);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Verificar integridad de backup',
    description: 'Verifica que el backup no esté corrupto (requiere ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID del backup' })
  @ApiResponse({ status: 200, description: 'Backup verificado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  verify(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.backups.verifyBackup(id).then((isValid: boolean) => ({
      id,
      isValid,
    }));
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Eliminar backup',
    description: 'Elimina un backup (requiere ADMIN)',
  })
  @ApiParam({ name: 'id', description: 'ID del backup' })
  @ApiResponse({ status: 200, description: 'Backup eliminado' })
  @ApiResponse({ status: 404, description: 'Backup no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  delete(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.backups.deleteBackup(id);
  }
}
