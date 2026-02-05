import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CashMovementTypeDto } from './create-movement.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListMovementsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de sesión de caja',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4')
  sessionId?: string;

  @ApiPropertyOptional({
    enum: CashMovementTypeDto,
    description: 'Filtrar por tipo: IN, OUT, ADJUST',
  })
  @IsOptional()
  @IsEnum(CashMovementTypeDto)
  type?: CashMovementTypeDto;

  @ApiPropertyOptional({
    description:
      'Fecha inicial (ISO 8601). Filtra movimientos desde esta fecha.',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha final (ISO 8601). Filtra movimientos hasta esta fecha.',
    example: '2025-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
