import {
  Body,
  Controller,
  Get,
  HttpCode,
  ParseUUIDPipe,
  Param,
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
import { PurchasesService } from './purchases.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModulesGuard } from '../auth/modules.guard';
import { RequireModule } from '../auth/require-module.decorator';

@ApiTags('purchases')
@UseGuards(JwtAuthGuard, ModulesGuard)
@RequireModule('suppliers')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar pedidos de compra',
    description: 'Obtiene todos los pedidos de compra. Respuesta paginada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de pedidos de compra',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  list(
    @Query() pagination?: PaginationDto,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.purchases.listPurchaseOrders(
      { page: pagination?.page, limit: pagination?.limit },
      req?.user?.tenantId,
    );
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener pedido de compra por ID',
    description: 'Obtiene los detalles de un pedido de compra específico',
  })
  @ApiParam({ name: 'id', description: 'ID del pedido de compra' })
  @ApiResponse({ status: 200, description: 'Pedido encontrado' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req?: { user?: { tenantId?: string } },
  ) {
    return this.purchases.getPurchaseOrder(id, req?.user?.tenantId);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear pedido de compra',
    description: 'Crea un nuevo pedido de compra a un proveedor',
  })
  @ApiResponse({ status: 201, description: 'Pedido creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  create(
    @Body() dto: CreatePurchaseOrderDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.purchases.createPurchaseOrder(
      dto,
      req.user?.sub,
      req.user?.tenantId,
    );
  }

  @Post(':id/receive')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Recibir pedido de compra',
    description:
      'Marca un pedido como recibido (parcial o completo) y crea movimiento de inventario automático',
  })
  @ApiParam({ name: 'id', description: 'ID del pedido de compra' })
  @ApiResponse({ status: 200, description: 'Pedido recibido exitosamente' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  receive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @Req() req: { user?: { sub?: string; tenantId?: string } },
  ) {
    return this.purchases.receivePurchaseOrder(
      id,
      dto,
      req.user?.sub,
      req.user?.tenantId,
    );
  }
}
