import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

class SaleItemInputDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @Type(() => Number)
  @IsInt()
  qty!: number;

  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;
}

export class CreateSaleDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  cashSessionId?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];
}

