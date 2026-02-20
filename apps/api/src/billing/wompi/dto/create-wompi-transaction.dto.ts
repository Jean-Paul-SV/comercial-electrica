import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsObject, IsOptional, IsEnum, Min } from 'class-validator';

/** Tipos de método de pago soportados por Wompi para suscripción. */
export type WompiPaymentMethodType = 'NEQUI' | 'PSE' | 'CARD';

/** Objeto payment_method para NEQUI. */
export interface WompiPaymentMethodNequi {
  type: 'NEQUI';
  phone_number: string;
}

/** Objeto payment_method para PSE (simplificado; el backend puede completar). */
export interface WompiPaymentMethodPse {
  type: 'PSE';
  user_type: number;
  user_legal_id_type: string;
  user_legal_id: string;
  financial_institution_code: string;
  payment_description: string;
}

/** Objeto payment_method para CARD (token generado en front con llave pública). */
export interface WompiPaymentMethodCard {
  type: 'CARD';
  token: string;
  installments: number;
}

export type WompiPaymentMethod =
  | WompiPaymentMethodNequi
  | WompiPaymentMethodPse
  | WompiPaymentMethodCard;

export class CreateWompiTransactionDto {
  @ApiProperty({ description: 'ID del plan a contratar' })
  @IsString()
  planId!: string;

  @ApiProperty({ enum: ['monthly', 'yearly'], description: 'Intervalo de facturación' })
  @IsEnum(['monthly', 'yearly'])
  billingInterval!: 'monthly' | 'yearly';

  @ApiProperty({ description: 'Token de aceptación de términos (obtenido de GET merchant)' })
  @IsString()
  acceptance_token!: string;

  @ApiProperty({ description: 'Token de aceptación de datos personales' })
  @IsString()
  accept_personal_auth!: string;

  @ApiProperty({ description: 'Email del cliente' })
  @IsString()
  customer_email!: string;

  @ApiProperty({ enum: ['NEQUI', 'PSE', 'CARD'], description: 'Tipo de método de pago' })
  @IsEnum(['NEQUI', 'PSE', 'CARD'])
  payment_method_type!: WompiPaymentMethodType;

  @ApiProperty({ description: 'Objeto con datos del método de pago (type, phone_number para NEQUI; type, token, installments para CARD; etc.)' })
  @IsObject()
  payment_method!: WompiPaymentMethod;

  @ApiPropertyOptional({ description: 'Nombre completo del cliente (recomendado para PSE)' })
  @IsOptional()
  @IsString()
  customer_full_name?: string;

  @ApiPropertyOptional({ description: 'Teléfono del cliente (recomendado para PSE)' })
  @IsOptional()
  @IsString()
  customer_phone?: string;
}

export class WompiMerchantResponseDto {
  @ApiPropertyOptional()
  presigned_acceptance?: { acceptance_token: string; permalink: string; type: string };
  @ApiPropertyOptional()
  presigned_personal_data_auth?: { acceptance_token: string; permalink: string; type: string };
}

export class WompiTransactionResponseDto {
  @ApiProperty()
  transactionId!: string;
  @ApiProperty({ description: 'Estado: PENDING, APPROVED, DECLINED, ERROR, VOIDED' })
  status!: string;
  @ApiPropertyOptional({ description: 'URL para redirigir al usuario (PSE, Bancolombia, etc.)' })
  async_payment_url?: string;
  @ApiPropertyOptional()
  status_message?: string;
}
