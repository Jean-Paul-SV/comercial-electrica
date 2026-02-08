import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsIn, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class TrendingProductsDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Inicio del período (ISO). Si se envían startDate y endDate, se usan en lugar de period/days.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-01-31',
    description: 'Fin del período (ISO). Si se envían startDate y endDate, se usan en lugar de period/days.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 30,
    description: 'Días hacia atrás (solo si period=last_days). Ignorado si period=current_month o si se envían startDate/endDate',
    minimum: 1,
    maximum: 365,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Cantidad máxima de artículos a devolver',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  top?: number;

  @ApiPropertyOptional({
    enum: ['revenue', 'qty'],
    description: 'Ordenar por ingreso total (revenue) o por unidades vendidas (qty). Por defecto revenue.',
  })
  @IsOptional()
  @IsIn(['revenue', 'qty'])
  sortBy?: 'revenue' | 'qty';

  @ApiPropertyOptional({
    enum: ['last_days', 'current_month'],
    description: 'last_days = últimos N días (según days). current_month = desde el día 1 del mes actual.',
  })
  @IsOptional()
  @IsIn(['last_days', 'current_month'])
  period?: 'last_days' | 'current_month';
}
