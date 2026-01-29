import { Type } from 'class-transformer';
import {
  IsDateString,
  IsDecimal,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierInvoiceDto {
  @ApiProperty({
    example: 'supplier-uuid-123',
    description: 'ID del proveedor',
  })
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional({
    example: 'purchase-order-uuid-123',
    description: 'ID del pedido de compra asociado (opcional)',
  })
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @ApiProperty({
    example: 'FAC-2026-001',
    description: 'Número de factura del proveedor',
  })
  @IsString()
  @MinLength(3)
  invoiceNumber!: string;

  @ApiProperty({
    example: '2026-02-03T00:00:00Z',
    description: 'Fecha de la factura',
  })
  @IsDateString()
  invoiceDate!: string;

  @ApiProperty({
    example: '2026-02-18T00:00:00Z',
    description: 'Fecha de vencimiento del pago',
  })
  @IsDateString()
  dueDate!: string;

  @ApiProperty({
    example: 200000,
    description: 'Subtotal (sin impuestos)',
    minimum: 0,
  })
  @Type(() => Number)
  @Min(0)
  subtotal!: number;

  @ApiProperty({
    example: 38000,
    description: 'Total de impuestos',
    minimum: 0,
  })
  @Type(() => Number)
  @Min(0)
  taxTotal!: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Total de descuentos',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  discountTotal?: number;

  @ApiPropertyOptional({
    example: 'Factura por pedido PO-202602-0001',
    description: 'Notas adicionales (opcional)',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
