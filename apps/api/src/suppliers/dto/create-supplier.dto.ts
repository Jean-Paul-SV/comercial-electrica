import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({
    example: '900123456-7',
    description: 'NIT del proveedor (único)',
    minLength: 5,
  })
  @IsString()
  @MinLength(5)
  nit!: string;

  @ApiProperty({
    example: 'Distribuidora Eléctrica S.A.S.',
    description: 'Razón social',
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'Proveedor de materiales eléctricos y canaletas.',
    description: 'Descripción del proveedor (opcional)',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'contacto@proveedor.com',
    description: 'Email (opcional)',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '3001234567',
    description: 'Teléfono (opcional)',
    minLength: 7,
  })
  @IsOptional()
  @IsString()
  @MinLength(7)
  phone?: string;

  @ApiPropertyOptional({
    example: 'Calle 123 # 45-67',
    description: 'Dirección (opcional)',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: '11001',
    description: 'Código ciudad (opcional)',
  })
  @IsOptional()
  @IsString()
  cityCode?: string;

  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Persona de contacto (opcional)',
  })
  @IsOptional()
  @IsString()
  contactPerson?: string;
}
