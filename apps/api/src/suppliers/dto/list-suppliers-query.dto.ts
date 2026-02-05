import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query params para listar proveedores (paginación + filtro isActive + búsqueda).
 * Evita que ValidationPipe con forbidNonWhitelisted rechace isActive/search.
 */
export class ListSuppliersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Si es true, solo devuelve proveedores activos. Si no se envía, devuelve todos (incl. deshabilitados).',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;

  @ApiPropertyOptional({
    description:
      'Buscar por NIT, nombre, contacto o email (contiene, sin distinguir mayúsculas)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
