import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query params para listar clientes (paginación + búsqueda + orden).
 */
export class ListCustomersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Buscar por nombre, número de documento o teléfono',
    example: 'Juan',
    type: String,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Orden por nombre: asc (A-Z) o desc (Z-A)',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
