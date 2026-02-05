import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

const BOOLEAN_STRING = ['true', 'false', '1', '0'] as const;

/**
 * Query params para listar productos (paginación + filtros zeroStock/lowStock).
 * Evita que ValidationPipe con forbidNonWhitelisted rechace zeroStock/lowStock.
 */
export class ListProductsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Solo productos con 0 unidades en stock',
    enum: ['true', 'false', '1', '0'],
  })
  @IsOptional()
  @IsIn(BOOLEAN_STRING)
  zeroStock?: string;

  @ApiPropertyOptional({
    description: 'Solo productos con stock bajo',
    enum: ['true', 'false', '1', '0'],
  })
  @IsOptional()
  @IsIn(BOOLEAN_STRING)
  lowStock?: string;

  @ApiPropertyOptional({
    description:
      'Umbral de stock bajo (por defecto 10). Solo aplica cuando lowStock=true',
    example: 10,
    minimum: 0,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({
    description: 'Stock mínimo (filtro por cantidad mínima de stock)',
    example: 5,
    minimum: 0,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({
    description: 'Stock máximo (filtro por cantidad máxima de stock)',
    example: 100,
    minimum: 0,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStock?: number;

  @ApiPropertyOptional({
    description: 'Buscar productos por nombre o código interno',
    example: 'cable',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Ordenar por stock: asc = menor a mayor, desc = mayor a menor',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortByStock?: 'asc' | 'desc';
}
