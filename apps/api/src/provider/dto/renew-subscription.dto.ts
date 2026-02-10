import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class RenewSubscriptionDto {
  /** Días a añadir al periodo (por defecto 30). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  extendDays?: number = 30;
}
