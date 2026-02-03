import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  email!: string;
}
