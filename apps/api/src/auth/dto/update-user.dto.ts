import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { RoleName } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password?: string;
}
