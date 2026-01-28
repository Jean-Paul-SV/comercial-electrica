import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  Min,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { InventoryMovementType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class MovementItemDto {
  @ApiProperty({ example: 'product-uuid-123', description: 'ID del producto' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 10, description: 'Cantidad', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiPropertyOptional({
    example: 1200,
    description: 'Costo unitario (opcional)',
    minimum: 0.01,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitCost?: number;
}

export class CreateMovementDto {
  @ApiProperty({
    enum: InventoryMovementType,
    example: InventoryMovementType.IN,
    description: 'Tipo de movimiento (entrada/salida)',
  })
  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @ApiPropertyOptional({
    example: 'Ajuste por inventario físico',
    description: 'Motivo/nota del movimiento (opcional)',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    type: [MovementItemDto],
    description: 'Items del movimiento (mínimo 1)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MovementItemDto)
  items!: MovementItemDto[];
}
