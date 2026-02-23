import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RecordVisitDto {
  @ApiProperty({
    description: 'Ruta/página visitada (ej. /app, /sales, /inventory)',
    example: '/sales',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  path!: string;

  @ApiProperty({ required: false, description: 'Título o etiqueta de la página (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
