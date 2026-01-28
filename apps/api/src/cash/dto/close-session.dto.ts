import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CloseSessionDto {
  @ApiProperty({
    example: 120000,
    description: 'Monto de cierre',
  })
  @Type(() => Number)
  @IsNumber()
  closingAmount!: number;
}
