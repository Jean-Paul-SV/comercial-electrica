import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ReturnItemDto {
  @ApiProperty({ example: 'product-uuid-123', description: 'ID del producto' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 2, description: 'Cantidad a devolver', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateReturnDto {
  @ApiProperty({
    example: 'sale-uuid-123',
    description: 'ID de la venta a la que pertenece la devolución',
  })
  @IsUUID()
  saleId!: string;

  @ApiPropertyOptional({
    example: 'Cliente no conforme con el producto',
    description: 'Motivo de la devolución (opcional)',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    type: [ReturnItemDto],
    description: 'Items a devolver (productos y cantidades)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];
}
