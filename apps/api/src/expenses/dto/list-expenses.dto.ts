import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, Max, IsIn } from 'class-validator';

export class ListExpensesDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Fecha inicio (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-01-31',
    description: 'Fecha fin (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'all',
    description:
      'Tipo: all = todos, compras = gastos por compras (Factura proveedor), otros = resto',
    enum: ['all', 'compras', 'otros'],
  })
  @IsOptional()
  @IsIn(['all', 'compras', 'otros'])
  expenseType?: 'all' | 'compras' | 'otros';

  @ApiPropertyOptional({
    example: 'Oficina',
    description:
      'Filtrar por categoría exacta (solo cuando expenseType es all)',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    example: 'inventario',
    description:
      'Buscar en categoría o descripción (contiene, sin distinguir mayúsculas)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'uuid-sesion-caja',
    description: 'Filtrar gastos descontados de esta sesión de caja',
  })
  @IsOptional()
  @IsString()
  cashSessionId?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Página (desde 1)',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Resultados por página',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
