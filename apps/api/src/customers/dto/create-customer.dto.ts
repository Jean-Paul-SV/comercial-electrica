import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CustomerDocType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({
    enum: CustomerDocType,
    example: CustomerDocType.CC,
    description: 'Tipo de documento',
  })
  @IsEnum(CustomerDocType)
  docType!: CustomerDocType;

  @ApiProperty({
    example: '1234567890',
    description: 'Número de documento',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  docNumber!: string;

  @ApiProperty({ example: 'Juan Pérez', description: 'Nombre/Razón social' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'cliente@correo.com',
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
}
