import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CashService } from './cash.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';

@ApiTags('cash')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('sessions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Listar sesiones de caja', description: 'Obtiene todas las sesiones ordenadas por fecha descendente' })
  @ApiResponse({ status: 200, description: 'Lista de sesiones' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  listSessions() {
    return this.cash.listSessions();
  }

  @Post('sessions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Abrir sesión de caja', description: 'Abre una nueva sesión de caja con un monto inicial' })
  @ApiResponse({ status: 201, description: 'Sesión abierta exitosamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  open(@Body() dto: OpenSessionDto, @Req() req: { user?: { sub?: string } }) {
    return this.cash.openSession(dto.openingAmount, req.user?.sub);
  }

  @Post('sessions/:id/close')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cerrar sesión de caja', description: 'Cierra una sesión de caja con el monto final' })
  @ApiParam({ name: 'id', description: 'ID de la sesión de caja' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  close(@Param('id') id: string, @Body() dto: CloseSessionDto) {
    return this.cash.closeSession(id, dto.closingAmount);
  }

  @Get('sessions/:id/movements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Listar movimientos de una sesión', description: 'Obtiene todos los movimientos de una sesión de caja' })
  @ApiParam({ name: 'id', description: 'ID de la sesión de caja' })
  @ApiResponse({ status: 200, description: 'Lista de movimientos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  movements(@Param('id') id: string) {
    return this.cash.listMovements(id);
  }
}

