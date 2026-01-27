import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InventoryReportDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Mostrar solo productos con stock bajo',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  lowStock?: boolean;

  @ApiPropertyOptional({
    example: 10,
    description: 'Umbral de stock bajo (por defecto 10)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({
    example: 'category-uuid-123',
    description: 'Filtrar por categoría',
  })
  @IsOptional()
  categoryId?: string;
}
