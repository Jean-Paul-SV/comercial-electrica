import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export const EXPORT_ENTITIES = ['sales', 'customers'] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];

export class ExportReportDto {
  @ApiProperty({
    example: 'sales',
    description: 'Entidad a exportar',
    enum: EXPORT_ENTITIES,
  })
  @IsIn(EXPORT_ENTITIES)
  entity!: ExportEntity;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Fecha de inicio (ventas: soldAt; clientes: sin filtro por defecto)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-01-31',
    description: 'Fecha de fin',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Límite de filas (máximo 5000)',
    minimum: 1,
    maximum: 5000,
    default: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
