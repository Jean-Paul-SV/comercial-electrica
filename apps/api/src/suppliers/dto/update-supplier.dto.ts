import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto';

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  @ApiPropertyOptional({
    example: true,
    description: 'Proveedor activo (visible en listas y selección) o inactivo',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
