import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query params para listar movimientos (paginación + búsqueda por producto + orden).
 * Evita que ValidationPipe con forbidNonWhitelisted rechace search/sortOrder.
 */
export class ListMovementsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Buscar movimientos que contengan un producto con este nombre o código',
    example: 'cable',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Ordenar por fecha: desc = más reciente primero (Mayor), asc = más antiguo primero (Menor)',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
