import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

/**
 * DTO para parámetros de paginación
 * Usado en todos los endpoints de listado
 */
export class PaginationDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Número de página (empezando en 1)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Cantidad de resultados por página',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /**
   * Calcula el skip (offset) basado en la página
   */
  get skip(): number {
    const page = this.page ?? 1;
    const limit = this.limit ?? 20;
    return (page - 1) * limit;
  }

  /**
   * Obtiene el take (limit) para Prisma
   */
  get take(): number {
    return this.limit ?? 20;
  }
}
