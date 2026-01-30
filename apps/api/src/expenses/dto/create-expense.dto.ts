import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class CreateExpenseDto {
  @ApiProperty({
    example: 50000,
    description: 'Monto del gasto (COP)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  amount!: number;

  @ApiProperty({
    example: 'Compra material de oficina',
    description: 'Descripción del gasto',
  })
  @IsString()
  description!: string;

  @ApiPropertyOptional({
    example: 'Oficina',
    description: 'Categoría del gasto (ej. Oficina, Servicios, Mantenimiento)',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    example: '2026-01-29T21:00:00.000Z',
    description: 'Fecha del gasto (por defecto: ahora)',
  })
  @IsOptional()
  @IsString()
  expenseDate?: string;

  @ApiProperty({
    enum: PaymentMethod,
    description: 'Método de pago',
    example: 'CASH',
  })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({
    example: 'uuid-sesion-caja',
    description: 'Si se pagó desde caja, ID de la sesión para registrar salida',
  })
  @IsOptional()
  @IsUUID('4')
  cashSessionId?: string;

  @ApiPropertyOptional({
    example: 'Factura 123',
    description: 'Referencia (número de factura, etc.)',
  })
  @IsOptional()
  @IsString()
  reference?: string;
}
