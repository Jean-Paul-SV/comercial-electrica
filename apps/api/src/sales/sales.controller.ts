import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list() {
    return this.sales.listSales();
  }

  @Post()
  create(@Body() dto: CreateSaleDto, @Req() req: { user?: { sub?: string } }) {
    return this.sales.createSale(dto, req.user?.sub);
  }
}

