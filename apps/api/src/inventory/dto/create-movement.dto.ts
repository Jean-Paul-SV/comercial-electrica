import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { InventoryMovementType } from '@prisma/client';

class MovementItemDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @Type(() => Number)
  @IsInt()
  qty!: number;

  @IsOptional()
  @Type(() => Number)
  unitCost?: number;
}

export class CreateMovementDto {
  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MovementItemDto)
  items!: MovementItemDto[];
}

