import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsDateString } from 'class-validator';

export class CashReportDto {
  @ApiPropertyOptional({
    example: 'session-uuid-123',
    description: 'Filtrar por ID de sesión de caja',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00Z',
    description: 'Fecha de inicio del reporte',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-01-31T23:59:59Z',
    description: 'Fecha de fin del reporte',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
