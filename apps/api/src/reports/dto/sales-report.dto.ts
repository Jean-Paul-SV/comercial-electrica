import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SalesReportDto {
  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00Z',
    description: 'Fecha de inicio del reporte',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-01-31T23:59:59Z',
    description: 'Fecha de fin del reporte',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'customer-uuid-123',
    description: 'Filtrar por ID de cliente',
  })
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    example: 100,
    description: 'Límite de resultados',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
