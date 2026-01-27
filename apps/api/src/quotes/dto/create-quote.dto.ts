import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class QuoteItemInputDto {
  @ApiProperty({ example: 'product-uuid-123', description: 'ID del producto' })
  @IsString()
  @MinLength(1)
  productId!: string;

  @ApiProperty({ example: 5, description: 'Cantidad cotizada', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiPropertyOptional({
    example: 2500,
    description: 'Precio unitario personalizado (opcional, usa precio del producto si no se proporciona)',
  })
  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;
}

export class CreateQuoteDto {
  @ApiPropertyOptional({
    example: 'customer-uuid-123',
    description: 'ID del cliente (opcional)',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    example: '2026-02-15T00:00:00Z',
    description: 'Fecha de validez de la cotización (opcional, por defecto 30 días desde hoy)',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({
    type: [QuoteItemInputDto],
    description: 'Items de la cotización',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemInputDto)
  items!: QuoteItemInputDto[];
}
