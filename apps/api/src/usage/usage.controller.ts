import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsageService } from './usage.service';
import { RecordUsageDto } from './dto/record-usage.dto';

@ApiTags('usage')
@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @UseGuards(JwtAuthGuard)
  @Post('events')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Registrar evento de uso',
    description:
      'Registra un evento de uso para mejorar el producto (uso interno, sin vender datos). tenantId y userId se toman del JWT.',
  })
  @ApiResponse({ status: 201, description: 'Evento registrado.' })
  @ApiResponse({ status: 400, description: 'Body inválido.' })
  async record(
    @Req() req: { user?: { sub?: string; tenantId?: string | null } },
    @Body() dto: RecordUsageDto,
  ): Promise<{ ok: true }> {
    await this.usage.record(dto.event, {
      tenantId: req.user?.tenantId ?? null,
      userId: req.user?.sub ?? null,
      payload: dto.payload,
    });
    return { ok: true };
  }
}
