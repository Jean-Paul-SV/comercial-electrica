import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
  ApiParam,
} from '@nestjs/swagger';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('returns')
@UseGuards(JwtAuthGuard)
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Registrar devolución',
    description:
      'Registra una devolución de una venta. Los ítems deben pertenecer a la venta y la cantidad no puede superar lo vendido (menos lo ya devuelto). Se devuelve stock al inventario.',
  })
  @ApiResponse({ status: 201, description: 'Devolución registrada' })
  @ApiResponse({
    status: 400,
    description:
      'Venta no encontrada, producto no pertenece a la venta, cantidad excede lo vendido.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Sin tenant (solo usuarios de empresa)',
  })
  create(
    @Body() dto: CreateReturnDto,
    @Req() req: { user?: { sub?: string; tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId ?? null;
    if (tenantId == null) {
      throw new ForbiddenException(
        'Solo usuarios de una empresa pueden registrar devoluciones.',
      );
    }
    return this.returns.createReturn(dto, req.user?.sub, tenantId);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar devoluciones',
    description: 'Lista las devoluciones del tenant del usuario, paginadas.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de devoluciones' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin tenant' })
  list(
    @Query('page', new DefaultValuePipe(1), new ParseIntPipe()) page: number,
    @Query('limit', new DefaultValuePipe(20), new ParseIntPipe()) limit: number,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId ?? null;
    if (tenantId == null) {
      throw new ForbiddenException(
        'Solo usuarios de una empresa pueden listar devoluciones.',
      );
    }
    return this.returns.listReturns(tenantId, { page, limit });
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener devolución por ID',
    description:
      'Devuelve el detalle de una devolución del tenant del usuario.',
  })
  @ApiParam({ name: 'id', description: 'ID de la devolución' })
  @ApiResponse({ status: 200, description: 'Devolución encontrada' })
  @ApiResponse({ status: 404, description: 'Devolución no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: { tenantId?: string | null } },
  ) {
    const tenantId = req.user?.tenantId ?? null;
    if (tenantId == null) {
      throw new ForbiddenException(
        'Solo usuarios de una empresa pueden consultar devoluciones.',
      );
    }
    return this.returns.getReturnById(id, tenantId);
  }
}
