import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListAuditLogsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Filtrar por tipo de entidad (sale, quote, customer, product, expense, etc.)',
    example: 'sale',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por acción (create, update, delete, login, convert, etc.)',
    example: 'create',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @ApiPropertyOptional({
    description: 'Fecha inicial (ISO 8601). Filtra registros desde esta fecha.',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha final (ISO 8601). Filtra registros hasta esta fecha.',
    example: '2025-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Buscar por ID de entidad o email del usuario',
    example: 'usuario@ejemplo.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
