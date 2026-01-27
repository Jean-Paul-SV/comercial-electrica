import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  internalCode!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @Type(() => Number)
  @IsPositive()
  cost!: number;

  @Type(() => Number)
  @IsPositive()
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
