import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ListProductDictionaryQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por texto en el término',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por producto asociado',
  })
  @IsOptional()
  @IsUUID('4')
  productId?: string;
}
