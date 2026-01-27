import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class OpenSessionDto {
  @Type(() => Number)
  @IsNumber()
  openingAmount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
