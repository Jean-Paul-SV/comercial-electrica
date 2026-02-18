import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    example: 'INT-0001',
    description: 'Código interno del producto',
  })
  @IsString()
  @MinLength(1)
  internalCode!: string;

  @ApiProperty({
    example: 'Cable THHN 12 AWG',
    description: 'Nombre del producto',
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'category-uuid-123',
    description: 'ID de la categoría (opcional)',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ example: 1200, description: 'Costo unitario', minimum: 0.01 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  cost!: number;

  @ApiProperty({ example: 2500, description: 'Precio de venta', minimum: 0.01 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiPropertyOptional({
    example: 19,
    description: 'Impuesto (%) (opcional)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Stock mínimo por producto para alertas; si no se envía, se usa el umbral global.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Producto activo/inactivo (opcional, por defecto true)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
