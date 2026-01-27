import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Email del usuario',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Admin123!',
    description: 'Contraseña del usuario (mínimo 8 caracteres)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
