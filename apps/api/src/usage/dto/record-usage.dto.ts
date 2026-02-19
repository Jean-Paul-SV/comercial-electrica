import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsObject } from 'class-validator';

export class RecordUsageDto {
  @ApiProperty({
    description: 'Código del evento (ej: screen_view, sale_created). Sin PII.',
    example: 'screen_view',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  event: string;

  @ApiPropertyOptional({
    description: 'Datos opcionales para contexto (ej: { section: "sales" }). Sin datos personales.',
    example: { section: 'sales' },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
