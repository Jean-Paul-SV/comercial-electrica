import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { RoleName } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('bootstrap-admin')
  @ApiOperation({
    summary: 'Crear primer usuario administrador',
    description:
      'Solo funciona si no hay usuarios en la BD. Usar solo la primera vez.',
  })
  @ApiResponse({
    status: 201,
    description: 'Administrador creado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Bootstrap ya fue realizado' })
  bootstrapAdmin(@Body() dto: BootstrapAdminDto) {
    return this.auth.bootstrapAdmin(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: 'Obtener token JWT para autenticación',
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    schema: { type: 'object', properties: { accessToken: { type: 'string' } } },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @Post('users')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Registrar nuevo usuario',
    description: 'Requiere rol ADMIN',
  })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Email ya registrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  register(
    @Body() dto: RegisterUserDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.auth.register(dto, req.user?.sub);
  }
}
