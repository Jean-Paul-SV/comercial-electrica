import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
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
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermission } from './require-permission.decorator';

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

  @Throttle({ forgot: { limit: 3, ttl: 900000 } })
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Solicitar restablecimiento de contraseña',
    description:
      'Envía un enlace por correo si SMTP está configurado; si no, en dev devuelve el token. No revela si el email existe. Límite: 3 solicitudes por 15 min por dirección de correo.',
  })
  @ApiResponse({ status: 200, description: 'Mensaje genérico (si el correo existe, se envía el enlace)' })
  @ApiResponse({ status: 429, description: 'Demasiadas solicitudes (3 por 15 min por email)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Restablecer contraseña con el token',
    description: 'Token recibido por correo o en respuesta de forgot-password (solo en dev).',
  })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('accept-invite')
  @ApiOperation({
    summary: 'Aceptar invitación y establecer contraseña',
    description: 'Token recibido por correo o en respuesta de invite (solo en dev).',
  })
  @ApiResponse({ status: 200, description: 'Contraseña establecida' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.auth.acceptInvite(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('users:create')
  @Post('invite')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Invitar usuario por correo',
    description: 'Crea usuario con contraseña temporal y devuelve token de invitación (7 días). Requiere users:create.',
  })
  @ApiResponse({ status: 201, description: 'Usuario invitado (user, inviteToken; en dev también tempPassword)' })
  @ApiResponse({ status: 400, description: 'Email ya registrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere permiso users:create)' })
  invite(
    @Body() dto: InviteUserDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.auth.inviteUser(dto, req.user!.sub!);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Usuario actual y permisos',
    description: 'Devuelve el usuario autenticado y la lista de permisos (resource:action) para el frontend.',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario, permisos y tenant con módulos habilitados',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } } },
        permissions: { type: 'array', items: { type: 'string' } },
        tenant: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            plan: { type: 'object', properties: { name: { type: 'string' }, slug: { type: 'string' } } },
            enabledModules: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getMe(@Req() req: { user?: { sub?: string } }) {
    return this.auth.getMe(req.user!.sub!);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cambiar mi contraseña',
    description: 'Cualquier usuario autenticado puede cambiar su propia contraseña.',
  })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada' })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta o nueva inválida' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  changeMyPassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.auth.changeMyPassword(req.user!.sub!, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('users:create')
  @Post('users')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Registrar nuevo usuario',
    description: 'Requiere permiso users:create',
  })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Email ya registrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere permiso users:create)' })
  register(
    @Body() dto: RegisterUserDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.auth.register(dto, req.user?.sub);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('users:read')
  @Get('users')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar usuarios del tenant',
    description: 'Requiere permiso users:read. Devuelve usuarios del mismo tenant.',
  })
  @ApiResponse({ status: 200, description: 'Lista de usuarios (id, email, role, createdAt)' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere permiso users:read)' })
  listUsers(@Req() req: { user?: { sub?: string; tenantId?: string | null } }) {
    return this.auth.listUsers(req.user?.tenantId ?? null);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('users:update')
  @Patch('users/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar usuario (rol y/o contraseña)',
    description: 'Requiere permiso users:update. Solo usuarios del mismo tenant.',
  })
  @ApiResponse({ status: 200, description: 'Usuario actualizado' })
  @ApiResponse({ status: 400, description: 'Usuario no encontrado o datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere permiso users:update)' })
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.auth.updateUser(id, dto, req.user!.sub!);
  }
}
