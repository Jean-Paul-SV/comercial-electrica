import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export const CashMovementTypeDto = ['IN', 'OUT', 'ADJUST'] as const;
export type CashMovementTypeDto = (typeof CashMovementTypeDto)[number];

export class CreateCashMovementDto {
  @ApiProperty({
    enum: CashMovementTypeDto,
    description: 'Tipo de movimiento: IN (entrada), OUT (salida), ADJUST (ajuste)',
    example: 'ADJUST',
  })
  @IsEnum(CashMovementTypeDto)
  type!: CashMovementTypeDto;

  @ApiProperty({
    enum: PaymentMethod,
    description: 'Forma de pago',
    example: 'CASH',
  })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({
    example: 50000,
    description: 'Monto (siempre positivo)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  amount!: number;

  @ApiPropertyOptional({
    example: 'Ajuste por conteo de caja',
    description: 'Motivo o referencia del movimiento',
  })
  @IsOptional()
  @IsString()
  reference?: string;
}
