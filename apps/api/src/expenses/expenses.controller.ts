import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
  ApiQuery,
} from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';

@ApiTags('expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  @RequirePermission('expenses:create')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Registrar gasto',
    description:
      'Registra un gasto. Si se indica sesión de caja, crea una salida en esa sesión.',
  })
  @ApiResponse({ status: 201, description: 'Gasto creado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o sesión cerrada' })
  @ApiResponse({ status: 404, description: 'Sesión de caja no encontrada' })
  @ApiResponse({
    status: 403,
    description: 'No autorizado (requiere permiso expenses:create)',
  })
  create(
    @Body() dto: CreateExpenseDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.expenses.create(dto, req.user?.sub, req.user?.tenantId);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar gastos',
    description: 'Lista gastos con filtros opcionales por fecha y categoría.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de gastos' })
  list(
    @Query() dto: ListExpensesDto,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.expenses.list(
      dto,
      { page: dto.page, limit: dto.limit },
      req?.user?.tenantId,
    );
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener gasto por ID' })
  @ApiParam({ name: 'id', description: 'ID del gasto' })
  @ApiResponse({ status: 200, description: 'Gasto encontrado' })
  @ApiResponse({ status: 404, description: 'Gasto no encontrado' })
  getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.expenses.getById(id, req?.user?.tenantId);
  }

  @Delete(':id')
  @RequirePermission('expenses:delete')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Eliminar gasto',
    description:
      'Elimina un gasto. Requiere justificación. Si estaba descontado de una sesión de caja, también se elimina ese movimiento.',
  })
  @ApiParam({ name: 'id', description: 'ID del gasto' })
  @ApiQuery({
    name: 'reason',
    required: true,
    description: 'Justificación de la eliminación',
  })
  @ApiResponse({ status: 200, description: 'Gasto eliminado' })
  @ApiResponse({ status: 400, description: 'Justificación requerida' })
  @ApiResponse({ status: 404, description: 'Gasto no encontrado' })
  @ApiResponse({
    status: 403,
    description: 'No autorizado (requiere permiso expenses:delete)',
  })
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('reason') reason: string | undefined,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    const trimmed = reason?.trim();
    if (!trimmed) {
      throw new BadRequestException(
        'La justificación de eliminación es obligatoria.',
      );
    }
    return this.expenses.remove(id, req.user?.sub, trimmed, req.user?.tenantId);
  }
}
