import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomersReportDto {
  @ApiPropertyOptional({
    example: 10,
    description: 'Número de mejores clientes a mostrar',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  top?: number;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00Z',
    description: 'Fecha de inicio para calcular mejores clientes',
  })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-01-31T23:59:59Z',
    description: 'Fecha de fin para calcular mejores clientes',
  })
  @IsOptional()
  endDate?: string;
}
