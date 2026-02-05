import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query params para listar ventas (paginación + búsqueda por cliente, factura o vendedor).
 */
export class ListSalesQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Buscar por nombre de cliente, número de factura o email del vendedor',
    example: 'Juan',
    type: String,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
