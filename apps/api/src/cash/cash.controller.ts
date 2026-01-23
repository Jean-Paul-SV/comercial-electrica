import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CashService } from './cash.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('sessions')
  listSessions() {
    return this.cash.listSessions();
  }

  @Post('sessions')
  open(@Body() dto: OpenSessionDto, @Req() req: { user?: { sub?: string } }) {
    return this.cash.openSession(dto.openingAmount, req.user?.sub);
  }

  @Post('sessions/:id/close')
  close(@Param('id') id: string, @Body() dto: CloseSessionDto) {
    return this.cash.closeSession(id, dto.closingAmount);
  }

  @Get('sessions/:id/movements')
  movements(@Param('id') id: string) {
    return this.cash.listMovements(id);
  }
}

