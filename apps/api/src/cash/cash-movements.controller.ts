import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CashService } from './cash.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCashMovementDto } from './dto/create-movement.dto';

@ApiTags('cash')
@UseGuards(JwtAuthGuard)
@Controller('cash/sessions/:id')
export class CashMovementsController {
  constructor(private readonly cash: CashService) {}

  @Post('add-movement')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Registrar movimiento manual',
    description:
      'Registra una entrada, salida o ajuste manual en una sesión de caja abierta.',
  })
  @ApiParam({ name: 'id', description: 'ID de la sesión de caja' })
  @ApiResponse({ status: 201, description: 'Movimiento creado' })
  @ApiResponse({ status: 400, description: 'Sesión cerrada o datos inválidos' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  createMovement(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateCashMovementDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.cash.createMovement(id, dto, req.user?.sub, req.user?.tenantId);
  }
}
