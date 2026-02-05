import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

class SaleItemInputDto {
  @ApiProperty({ example: 'product-uuid-123', description: 'ID del producto' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 5, description: 'Cantidad a vender', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiPropertyOptional({
    example: 2500,
    description:
      'Precio unitario personalizado (opcional, usa precio del producto si no se proporciona)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitPrice?: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({
    example: 'customer-uuid-123',
    description: 'ID del cliente (opcional)',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({
    example: 'session-uuid-123',
    description: 'ID de la sesión de caja (requerido)',
  })
  @IsUUID()
  cashSessionId!: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
    description: 'Método de pago',
  })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty({ type: [SaleItemInputDto], description: 'Items de la venta' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];

  @ApiPropertyOptional({
    example: 0,
    description:
      'Descuento total en COP (se resta del total). No puede superar subtotal + IVA.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountTotal?: number;
}
