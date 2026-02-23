import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrackingService } from './tracking.service';
import { RecordVisitDto } from './dto/record-visit.dto';

@ApiTags('tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('visit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Registrar visita a una página',
    description:
      'Registra una visita para el contador del panel proveedor (por empresa y por ruta).',
  })
  @ApiResponse({ status: 201, description: 'Visita registrada.' })
  @ApiResponse({ status: 400, description: 'Body inválido.' })
  async recordVisit(
    @Req() req: { user?: { sub?: string; tenantId?: string | null } },
    @Body() dto: RecordVisitDto,
  ): Promise<{ ok: true }> {
    await this.tracking.recordVisit({
      tenantId: req.user?.tenantId ?? null,
      userId: req.user?.sub ?? null,
      path: dto.path,
    });
    return { ok: true };
  }
}
