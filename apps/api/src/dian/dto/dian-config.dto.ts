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

  @ApiProperty({
    description: 'ID del software registrado en DIAN',
    example: '123456789',
  })
  @IsString()
  softwareId: string;

  @ApiProperty({
    description: 'PIN del software registrado en DIAN',
    example: 'abcdef123456',
  })
  @IsString()
  softwarePin: string;

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

  @ApiPropertyOptional({
    description: 'ID del software',
  })
  @IsOptional()
  @IsString()
  softwareId?: string;

  @ApiPropertyOptional({
    description: 'PIN del software',
  })
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
