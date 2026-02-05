import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import { UpdateOnboardingStatusDto } from './dto/update-onboarding-status.dto';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Estado del onboarding',
    description:
      'Devuelve status (not_started | in_progress | completed | skipped), step (1-3), checklist y si tiene caja abierta y al menos un producto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del onboarding',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['not_started', 'in_progress', 'completed', 'skipped'],
        },
        step: { type: 'number', enum: [1, 2, 3] },
        hasOpenCashSession: { type: 'boolean' },
        hasAtLeastOneProduct: { type: 'boolean' },
        checklist: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              done: { type: 'boolean' },
              href: { type: 'string' },
            },
          },
        },
      },
    },
  })
  getStatus(@Req() req: { user?: { sub?: string } }) {
    return this.onboarding.getStatus(req.user!.sub!);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar estado del onboarding',
    description: 'Marca in_progress, completed o skipped.',
  })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
  updateStatus(
    @Req() req: { user?: { sub?: string } },
    @Body() dto: UpdateOnboardingStatusDto,
  ) {
    return this.onboarding.updateStatus(req.user!.sub!, dto.status);
  }
}
