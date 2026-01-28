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
import { CreateMovementDto } from './dto/create-movement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  listMovements(@Query() pagination?: PaginationDto) {
    return this.inventory.listMovements({
      page: pagination?.page,
      limit: pagination?.limit,
    });
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
    @Body() dto: CreateMovementDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.inventory.createMovement(dto, req.user?.sub);
  }
}
