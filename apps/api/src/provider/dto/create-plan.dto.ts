import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlanDto {
  @ApiProperty({ description: 'Nombre del plan', example: 'Plan básico' })
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    description:
      'Identificador único (solo letras minúsculas, números y guiones)',
    example: 'plan-basico',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug debe contener solo letras minúsculas, números y guiones',
  })
  slug!: string;

  @ApiPropertyOptional({ description: 'Descripción del plan' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Precio mensual' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceMonthly?: number;

  @ApiPropertyOptional({ description: 'Precio anual' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceYearly?: number;

  @ApiPropertyOptional({
    description: 'Límite de usuarios por tenant (null = sin límite)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxUsers?: number | null;

  @ApiPropertyOptional({
    description: 'ID del precio recurrente mensual en Stripe (ej. price_xxx)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  stripePriceId?: string | null;

  @ApiPropertyOptional({
    description: 'ID del precio recurrente anual en Stripe (ej. price_yyy)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  stripePriceIdYearly?: string | null;

  @ApiPropertyOptional({
    description: 'Plan activo (visible en selector)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Incluir facturación electrónica DIAN (módulo electronic_invoicing). Si false, el plan es "sin DIAN".',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includesDian?: boolean;
}
