import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateProductDictionaryEntryDto {
  @ApiProperty({
    example: 'cable 2.5 rojo',
    description:
      'Término o frase que los clientes escriben al preguntar por productos',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1, { message: 'El término no puede estar vacío' })
  @MaxLength(200)
  term!: string;

  @ApiPropertyOptional({
    description: 'ID del producto al que se asocia este término (opcional)',
  })
  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @ApiPropertyOptional({
    description:
      'ID de la categoría a la que se asocia este término (opcional)',
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}
