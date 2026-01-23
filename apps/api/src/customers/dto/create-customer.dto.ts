import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CustomerDocType } from '@prisma/client';

export class CreateCustomerDto {
  @IsEnum(CustomerDocType)
  docType!: CustomerDocType;

  @IsString()
  @MinLength(3)
  docNumber!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  cityCode?: string;
}

