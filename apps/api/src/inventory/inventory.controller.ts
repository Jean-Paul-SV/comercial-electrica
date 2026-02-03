import {
  Body,
  Controller,
  Get,
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
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryMovementDto } from './dto/create-movement.dto';
import { ListMovementsQueryDto } from './dto/list-movements-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { RequireModule } from '../auth/require-module.decorator';

@ApiTags('inventory')
@UseGuards(JwtAuthGuard, ModulesGuard)
@RequireModule('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('movements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar movimientos de inventario',
    description:
      'Obtiene todos los movimientos ordenados por fecha descendente. Respuesta paginada.',
  })
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
  listMovements(
    @Query() query?: ListMovementsQueryDto,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.inventory.listMovements(
      {
        page: query?.page,
        limit: query?.limit,
        search: query?.search,
        sortOrder: query?.sortOrder,
      },
      req?.user?.tenantId,
    );
  }

  @Post('movements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear movimiento de inventario',
    description:
      'Crea un movimiento de entrada (IN), salida (OUT) o ajuste (ADJUST) y actualiza el stock',
  })
  @ApiResponse({ status: 201, description: 'Movimiento creado exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'Error de validación (stock insuficiente, etc.)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  createMovement(
    @Body() dto: CreateInventoryMovementDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.inventory.createMovement(dto, req.user?.sub, req.user?.tenantId);
  }
}
