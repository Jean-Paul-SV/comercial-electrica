import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Enviar sugerencia de mejora',
    description:
      'Los usuarios de un tenant pueden enviar sugerencias de mejoras. Se muestran en el panel proveedor.',
  })
  @ApiResponse({ status: 201, description: 'Sugerencia creada.' })
  @ApiResponse({ status: 400, description: 'Mensaje vacío o inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Solo usuarios con tenant pueden enviar.',
  })
  create(
    @Req() req: { user?: { sub?: string; tenantId?: string | null } },
    @Body() dto: CreateFeedbackDto,
  ) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.sub;
    if (!tenantId || !userId) {
      throw new ForbiddenException(
        'Solo los usuarios de una empresa pueden enviar sugerencias.',
      );
    }
    return this.feedback.create(tenantId, userId, dto.message);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Mis sugerencias enviadas',
    description: 'Lista las sugerencias que el usuario ha enviado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de sugerencias del usuario.',
  })
  getMy(@Req() req: { user?: { sub?: string; tenantId?: string | null } }) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.sub;
    if (!tenantId || !userId) {
      return [];
    }
    return this.feedback.findMy(tenantId, userId);
  }
}
