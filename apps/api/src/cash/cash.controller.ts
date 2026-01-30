import {
  Body,
  Controller,
  Get,
  HttpCode,
  ParseUUIDPipe,
  Param,
  Post,
  Query,
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
import { CashService } from './cash.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('cash')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('sessions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar sesiones de caja',
    description:
      'Obtiene todas las sesiones ordenadas por fecha descendente. Respuesta paginada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de sesiones',
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
  listSessions(@Query() pagination?: PaginationDto) {
    return this.cash.listSessions({
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }

  @Post('sessions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Abrir sesión de caja',
    description: 'Abre una nueva sesión de caja con un monto inicial',
  })
  @ApiResponse({ status: 201, description: 'Sesión abierta exitosamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async open(
    @Body() dto: OpenSessionDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.cash.openSession(dto.openingAmount, req.user?.sub);
  }

  @Post('sessions/:id/close')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cerrar sesión de caja',
    description: 'Cierra una sesión de caja con el monto final',
  })
  @ApiParam({ name: 'id', description: 'ID de la sesión de caja' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CloseSessionDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.cash.closeSession(id, dto.closingAmount, req.user?.sub);
  }

  @Get('sessions/:id/movements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar movimientos de una sesión',
    description:
      'Obtiene todos los movimientos de una sesión de caja. Respuesta paginada.',
  })
  @ApiParam({ name: 'id', description: 'ID de la sesión de caja' })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de movimientos',
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
  movements(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.cash.listMovements(id, {
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }

}
