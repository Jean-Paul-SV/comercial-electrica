import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlanDto {
  @ApiPropertyOptional({ description: 'Nombre del plan' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Descripción' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Precio mensual' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceMonthly?: number;

  @ApiPropertyOptional({ description: 'Precio anual' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceYearly?: number;

  @ApiPropertyOptional({ description: 'Límite de usuarios por tenant (null = sin límite)' })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxUsers?: number | null;

  @ApiPropertyOptional({ description: 'ID del precio recurrente en Stripe (ej. price_xxx)' })
  @IsOptional()
  @IsString()
  stripePriceId?: string | null;

  @ApiPropertyOptional({ description: 'Plan visible y asignable' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
