import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(monthly|yearly)$/, { message: 'billingInterval debe ser monthly o yearly' })
  billingInterval?: 'monthly' | 'yearly';
}
