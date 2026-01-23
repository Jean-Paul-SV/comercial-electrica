import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('movements')
  listMovements() {
    return this.inventory.listMovements();
  }

  @Post('movements')
  createMovement(@Body() dto: CreateMovementDto, @Req() req: { user?: { sub?: string } }) {
    return this.inventory.createMovement(dto, req.user?.sub);
  }
}

