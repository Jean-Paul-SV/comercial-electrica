import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { InvoiceStatus } from '@prisma/client';

/**
 * Query params para listar facturas de venta (paginación + búsqueda + estado).
 */
export class ListInvoicesQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Buscar por número de factura o nombre de cliente',
    example: 'INV-',
    type: String,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de la factura',
    enum: InvoiceStatus,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}
