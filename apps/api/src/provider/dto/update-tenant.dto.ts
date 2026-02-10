import { IsOptional, IsUUID } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsUUID()
  planId?: string;
}
