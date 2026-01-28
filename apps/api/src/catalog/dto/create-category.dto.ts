import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Iluminación', description: 'Nombre de la categoría' })
  @IsString()
  @MinLength(2)
  name!: string;
}
