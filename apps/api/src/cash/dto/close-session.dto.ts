import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class CloseSessionDto {
  @Type(() => Number)
  @IsNumber()
  closingAmount!: number;
}

