import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { RoleName } from '@prisma/client';

export class InviteUserDto {
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  email!: string;

  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;
}
