import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SupplierInvoiceStatus } from '@prisma/client';

export class UpdateStatusDto {
  @ApiProperty({
    enum: SupplierInvoiceStatus,
    description: 'Nuevo estado de la factura',
    example: 'PAID',
  })
  @IsEnum(SupplierInvoiceStatus)
  status!: SupplierInvoiceStatus;
}
