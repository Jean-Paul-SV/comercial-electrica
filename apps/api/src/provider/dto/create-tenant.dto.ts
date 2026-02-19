import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, {
    message: 'slug debe ser minúsculas, números o guiones (ej: mi-empresa)',
  })
  slug: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  /** Cobro recurrente en Stripe: 'monthly' (por defecto) o 'yearly'. Solo aplica si el plan tiene stripePriceIdYearly. */
  @IsOptional()
  @IsString()
  @Matches(/^(monthly|yearly)$/, { message: 'billingInterval debe ser monthly o yearly' })
  billingInterval?: 'monthly' | 'yearly';

  /** Email del primer usuario administrador (único en la plataforma). */
  @IsEmail()
  adminEmail: string;

  /** Nombre del admin (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  adminName?: string;

  /** Contraseña inicial. Si no se envía, se genera temporal y mustChangePassword=true. */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  adminPassword?: string;

  /** Nombre de la empresa para facturación (razón social). Se usará en las facturas. Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  issuerName?: string;

  /** Número de contacto del dueño o persona con quien comunicarse (soporte). Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;
}
