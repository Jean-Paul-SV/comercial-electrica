import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

class SaleItemInputDto {
  @ApiProperty({ example: 'product-uuid-123', description: 'ID del producto' })
  @IsString()
  @MinLength(1)
  productId!: string;

  @ApiProperty({ example: 5, description: 'Cantidad a vender', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  qty!: number;

  @ApiPropertyOptional({
    example: 2500,
    description:
      'Precio unitario personalizado (opcional, usa precio del producto si no se proporciona)',
  })
  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({
    example: 'customer-uuid-123',
    description: 'ID del cliente (opcional)',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({
    example: 'session-uuid-123',
    description: 'ID de la sesión de caja (requerido)',
  })
  @IsOptional()
  @IsString()
  cashSessionId?: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
    description: 'Método de pago',
  })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty({ type: [SaleItemInputDto], description: 'Items de la venta' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];
}
