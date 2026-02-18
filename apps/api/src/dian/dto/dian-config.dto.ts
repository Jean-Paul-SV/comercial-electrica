import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsInt, Min } from 'class-validator';
import { DianEnvironment } from '@prisma/client';

export class CreateDianConfigDto {
  @ApiProperty({
    description: 'Ambiente DIAN (HABILITACION o PRODUCCION)',
    enum: DianEnvironment,
    example: DianEnvironment.HABILITACION,
  })
  @IsEnum(DianEnvironment)
  env: DianEnvironment;

  @ApiPropertyOptional({
    description:
      'NIT del emisor (empresa). Obligatorio para envío real a DIAN.',
    example: '900123456-7',
  })
  @IsOptional()
  @IsString()
  issuerNit?: string;

  @ApiPropertyOptional({
    description: 'Razón social del emisor.',
    example: 'Mi Empresa S.A.S.',
  })
  @IsOptional()
  @IsString()
  issuerName?: string;

  @ApiPropertyOptional({
    description: 'ID del software registrado en DIAN',
    example: '123456789',
  })
  @IsOptional()
  @IsString()
  softwareId?: string;

  @ApiPropertyOptional({
    description: 'PIN del software registrado en DIAN',
    example: 'abcdef123456',
  })
  @IsOptional()
  @IsString()
  softwarePin?: string;

  @ApiPropertyOptional({
    description: 'Número de resolución DIAN',
    example: '18764000000010',
  })
  @IsOptional()
  @IsString()
  resolutionNumber?: string;

  @ApiPropertyOptional({
    description: 'Prefijo de numeración de facturas',
    example: 'FAC',
  })
  @IsOptional()
  @IsString()
  prefix?: string;

  @ApiPropertyOptional({
    description: 'Rango inicial de numeración',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rangeFrom?: number;

  @ApiPropertyOptional({
    description: 'Rango final de numeración',
    example: 999999,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rangeTo?: number;
}

export class UpdateDianConfigDto {
  @ApiPropertyOptional({
    description: 'Ambiente DIAN',
    enum: DianEnvironment,
  })
  @IsOptional()
  @IsEnum(DianEnvironment)
  env?: DianEnvironment;

  @ApiPropertyOptional({ description: 'NIT del emisor (empresa)' })
  @IsOptional()
  @IsString()
  issuerNit?: string;

  @ApiPropertyOptional({ description: 'Razón social del emisor' })
  @IsOptional()
  @IsString()
  issuerName?: string;

  @ApiPropertyOptional({ description: 'ID del software' })
  @IsOptional()
  @IsString()
  softwareId?: string;

  @ApiPropertyOptional({ description: 'PIN del software' })
  @IsOptional()
  @IsString()
  softwarePin?: string;

  @ApiPropertyOptional({
    description: 'Número de resolución',
  })
  @IsOptional()
  @IsString()
  resolutionNumber?: string;

  @ApiPropertyOptional({
    description: 'Prefijo de numeración',
  })
  @IsOptional()
  @IsString()
  prefix?: string;

  @ApiPropertyOptional({
    description: 'Rango inicial',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rangeFrom?: number;

  @ApiPropertyOptional({
    description: 'Rango final',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rangeTo?: number;
}

/** DTO para subida de certificado .p12 (contenido en base64 + contraseña). */
export class UploadCertificateDto {
  @ApiProperty({
    description: 'Contenido del archivo .p12 codificado en base64',
  })
  @IsString()
  certBase64: string;

  @ApiProperty({
    description: 'Contraseña del archivo .p12',
  })
  @IsString()
  password: string;
}
