import {
  Body,
  Controller,
  Get,
  Param,
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
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('returns')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  create(
    @Body() dto: CreateReturnDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.returns.createReturn(dto, req.user?.sub);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar devoluciones',
    description: 'Lista todas las devoluciones paginadas.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de devoluciones' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  list(@Query() pagination?: PaginationDto) {
    return this.returns.listReturns({
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener devolución por ID',
    description: 'Devuelve el detalle de una devolución.',
  })
  @ApiParam({ name: 'id', description: 'ID de la devolución' })
  @ApiResponse({ status: 200, description: 'Devolución encontrada' })
  @ApiResponse({ status: 404, description: 'Devolución no encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.returns.getReturnById(id);
  }
}
