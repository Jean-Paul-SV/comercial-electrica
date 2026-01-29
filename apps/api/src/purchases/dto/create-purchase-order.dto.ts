import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PurchaseOrderItemDto {
  @ApiProperty({ example: 'product-uuid-123', description: 'ID del producto' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 100, description: 'Cantidad a pedir', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiProperty({ example: 2000, description: 'Costo unitario', minimum: 0.01 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({
    example: 'supplier-uuid-123',
    description: 'ID del proveedor',
  })
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional({
    example: '2026-02-15T00:00:00Z',
    description: 'Fecha esperada de recepción (opcional)',
  })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional({
    example: 'Pedido urgente para reposición de stock',
    description: 'Notas adicionales (opcional)',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [PurchaseOrderItemDto],
    description: 'Items del pedido (mínimo 1)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}
