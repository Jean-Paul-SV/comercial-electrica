import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ActionableIndicatorsDto {
  @ApiPropertyOptional({
    example: 30,
    description: 'Días hacia atrás para calcular indicadores (ventas, rotación, etc.)',
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
