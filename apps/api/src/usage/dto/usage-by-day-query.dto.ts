import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UsageByDayQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por tenant (UUID)' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de evento (ej. screen_view)' })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({ description: 'Desde fecha ISO (ej. 2026-02-01)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta fecha ISO (ej. 2026-02-20). Por defecto últimos 30 días.' })
  @IsOptional()
  @IsString()
  to?: string;
}
