import { IsUUID, IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsUUID()
  planId: string;

  @IsEnum(['monthly', 'yearly'])
  billingInterval: 'monthly' | 'yearly';

  /** URL a la que redirigir tras completar o cancelar. Por defecto FRONTEND_URL/settings/billing */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  returnUrl?: string;
}
