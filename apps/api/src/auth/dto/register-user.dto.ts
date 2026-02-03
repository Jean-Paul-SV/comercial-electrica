import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RoleName } from '@prisma/client';

export class RegisterUserDto {
  @IsEmail()
  email!: string;

  /** Requerido si generateTempPassword no es true. Si generateTempPassword es true se ignora. */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password?: string;

  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  /** Si true, se genera contraseña temporal y el usuario debe cambiarla en el primer login. */
  @IsOptional()
  @IsBoolean()
  generateTempPassword?: boolean;
}
