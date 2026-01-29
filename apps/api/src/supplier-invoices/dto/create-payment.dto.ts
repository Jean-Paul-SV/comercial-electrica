import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({
    example: 100000,
    description: 'Monto del pago',
    minimum: 0.01,
  })
  @Type(() => Number)
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({
    example: '2026-02-10T00:00:00Z',
    description: 'Fecha del pago (opcional, por defecto ahora)',
  })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.TRANSFER,
    description: 'Método de pago',
  })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({
    example: 'TRF-20260210-001',
    description: 'Referencia del pago (número de transferencia, cheque, etc.)',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reference?: string;

  @ApiPropertyOptional({
    example: 'Pago parcial de factura',
    description: 'Notas adicionales (opcional)',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
