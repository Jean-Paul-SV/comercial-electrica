import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class ActionableIndicatorsDto {
  @ApiPropertyOptional({
    example: 30,
    description:
      'Días hacia atrás para calcular indicadores (ventas, rotación, etc.). Se ignora si se envían startDate y endDate.',
    minimum: 7,
    maximum: 365,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Inicio del período (usado con endDate para ventas por empleado por mes)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-01-31',
    description: 'Fin del período (usado con startDate)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Máximo de ítems por indicador (top N)',
    minimum: 5,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(50)
  top?: number;
}
