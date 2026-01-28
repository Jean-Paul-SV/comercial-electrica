import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpenSessionDto {
  @ApiProperty({
    example: 100000,
    description: 'Monto de apertura',
  })
  @Type(() => Number)
  @IsNumber()
  openingAmount!: number;

  @ApiPropertyOptional({
    example: 'Apertura turno mañana',
    description: 'Nota opcional',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
