import { IsUUID, IsOptional, IsEnum } from 'class-validator';

export class ChangePlanDto {
  @IsUUID()
  planId: string;

  /** Intervalo de facturación: 'monthly' o 'yearly'. Si no se envía, mantiene el actual del tenant. */
  @IsOptional()
  @IsEnum(['monthly', 'yearly'])
  billingInterval?: 'monthly' | 'yearly';
}
