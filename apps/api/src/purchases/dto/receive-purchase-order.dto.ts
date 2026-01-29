import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ReceivedItemDto {
  @ApiProperty({ example: 'purchase-order-item-uuid-123', description: 'ID del item del pedido' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: 95, description: 'Cantidad recibida (puede ser menor a la pedida)', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  receivedQty!: number;
}

export class ReceivePurchaseOrderDto {
  @ApiPropertyOptional({
    example: '2026-02-15T00:00:00Z',
    description: 'Fecha de recepción (opcional, por defecto ahora)',
  })
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @ApiProperty({
    type: [ReceivedItemDto],
    description: 'Items recibidos (mínimo 1)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivedItemDto)
  items!: ReceivedItemDto[];
}
