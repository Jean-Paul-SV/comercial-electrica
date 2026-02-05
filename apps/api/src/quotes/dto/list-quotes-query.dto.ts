import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { QuoteStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query params para listar cotizaciones (paginación + filtros status/customerId/search).
 * Evita que ValidationPipe con forbidNonWhitelisted rechace los parámetros.
 */
export class ListQuotesQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: QuoteStatus,
    description: 'Filtrar por estado de cotización',
  })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de cliente',
  })
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Buscar por nombre o número de documento del cliente',
    example: 'Juan',
    type: String,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
