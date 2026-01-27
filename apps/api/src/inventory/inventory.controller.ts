import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('movements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Listar movimientos de inventario', description: 'Obtiene todos los movimientos ordenados por fecha descendente' })
  @ApiResponse({ status: 200, description: 'Lista de movimientos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  listMovements() {
    return this.inventory.listMovements();
  }

  @Post('movements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Crear movimiento de inventario', 
    description: 'Crea un movimiento de entrada (IN), salida (OUT) o ajuste (ADJUST) y actualiza el stock' 
  })
  @ApiResponse({ status: 201, description: 'Movimiento creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación (stock insuficiente, etc.)' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  createMovement(@Body() dto: CreateMovementDto, @Req() req: { user?: { sub?: string } }) {
    return this.inventory.createMovement(dto, req.user?.sub);
  }
}

