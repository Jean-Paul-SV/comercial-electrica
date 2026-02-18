import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateProductDictionaryEntryDto {
  @ApiPropertyOptional({
    description:
      'ID del producto al que se asocia este término (null para desvincular)',
  })
  @IsOptional()
  @IsUUID('4')
  productId?: string | null;

  @ApiPropertyOptional({
    description:
      'ID de la categoría a la que se asocia este término (null para desvincular)',
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;
}
