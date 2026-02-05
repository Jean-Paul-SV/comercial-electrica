import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomerClustersDto {
  @ApiPropertyOptional({
    example: 90,
    description:
      'Días hacia atrás para ventas del cliente (monto total, última compra, cantidad de compras)',
    minimum: 30,
    maximum: 365,
    default: 90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Número de clusters (segmentos) K-means',
    minimum: 2,
    maximum: 10,
    default: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(10)
  k?: number;
}
