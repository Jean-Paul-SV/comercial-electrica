import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class ConvertQuoteDto {
  @ApiProperty({
    example: 'session-uuid-123',
    description: 'ID de la sesión de caja (requerido)',
  })
  @IsUUID()
  cashSessionId!: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
    description: 'Método de pago',
  })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
