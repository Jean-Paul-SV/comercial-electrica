import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({
    description: 'Descripción de la mejora o sugerencia',
    example: 'Sería útil poder exportar el listado de clientes a Excel.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'El mensaje no puede estar vacío.' })
  @MaxLength(2000, { message: 'El mensaje no puede superar 2000 caracteres.' })
  message: string;
}
