import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '@prisma/client';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../common/services/audit.service';
import { MailerService } from '../mailer/mailer.service';
import { PermissionsService } from './permissions.service';
import { TenantModulesService } from './tenant-modules.service';
import { StorageService } from '../common/services/storage.service';
import { PlanLimitsService } from '../common/services/plan-limits.service';
import { emailIsPlatformAdminOnly } from '../common/utils/platform-admin-emails';
import type { MulterFile } from '../common/types/multer';

export type JwtPayload = {
  sub: string;
  // email removido por seguridad - obtener desde BD usando sub
  role: RoleName;
  /** Tenant del usuario; si no tiene, se usa el default para aislamiento de datos. */
  tenantId?: string | null;
  /** true cuando el usuario no pertenece a ningún tenant (admin de plataforma). Usado p. ej. en GET /stats?tenantId= */
  isPlatformAdmin?: boolean;
};

export type MeResponse = {
  user: {
    id: string;
    email: string;
    role: RoleName;
    profilePictureUrl?: string | null;
  };
  permissions: string[];
  /** true cuando el usuario no pertenece a ningún tenant (admin de plataforma). */
  isPlatformAdmin?: boolean;
  tenant?: {
    id: string;
    name: string;
    plan?: { name: string; slug: string };
    enabledModules: string[];
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
    private readonly permissions: PermissionsService,
    private readonly tenantModules: TenantModulesService,
    private readonly storage: StorageService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  /** true si el usuario es admin de plataforma: sin tenant o su email está en PLATFORM_ADMIN_EMAILS. */
  private isPlatformAdminUser(tenantId: string | null, email: string): boolean {
    if (tenantId === null) return true;
    return emailIsPlatformAdminOnly(email);
  }

  async bootstrapAdmin(dto: BootstrapAdminDto) {
    const count = await this.prisma.user.count();
    if (count > 0) {
      throw new BadRequestException('Bootstrap ya fue realizado.');
    }
    const defaultTenantId = await this.tenantModules.getDefaultTenantId();
    const adminRole = await this.prisma.role.findFirst({
      where: { slug: 'admin', tenantId: null },
      select: { id: true },
    });
    if (!defaultTenantId || !adminRole) {
      throw new BadRequestException(
        'Ejecuta primero el seed para crear tenant y roles: npm run prisma:seed -w api',
      );
    }
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: RoleName.ADMIN,
        tenantId: defaultTenantId,
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id,
        tenantId: defaultTenantId,
      },
    });
    await this.audit.logCreate('user', user.id, null, {
      email: user.email,
      role: user.role,
    });
    return user;
  }

  async register(dto: RegisterUserDto, createdByUserId?: string) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email ya registrado.');
    const isPlatformOnly = emailIsPlatformAdminOnly(email);
    const tenantId = isPlatformOnly
      ? null
      : createdByUserId != null
        ? await this.tenantModules.getEffectiveTenantId(createdByUserId)
        : await this.tenantModules.getDefaultTenantId();
    if (!isPlatformOnly) await this.planLimits.validateUserLimit(tenantId);

    const generateTemp = dto.generateTempPassword === true;
    const password = generateTemp
      ? randomBytes(16).toString('hex')
      : (dto.password ?? '');
    if (!generateTemp && (!password || password.length < 8)) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres.',
      );
    }
    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name?.trim() || undefined,
        passwordHash,
        role: dto.role ?? RoleName.USER,
        tenantId: tenantId ?? undefined,
        mustChangePassword: generateTemp,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    await this.audit.logCreate('user', user.id, createdByUserId, {
      email: user.email,
      role: user.role,
      mustChangePassword: generateTemp,
    });
    if (generateTemp) {
      const isDev = process.env.NODE_ENV !== 'production';
      return isDev ? { ...user, tempPassword: password } : user;
    }
    return user;
  }

  /** Invitar usuario por correo: crea usuario con contraseña temporal y devuelve token de invitación (7 días). */
  async inviteUser(dto: InviteUserDto, createdByUserId: string) {
    const email = dto.email.toLowerCase();
    if (emailIsPlatformAdminOnly(email)) {
      throw new BadRequestException(
        'Este correo está reservado para el Panel proveedor y no puede asociarse a una empresa.',
      );
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email ya registrado.');
    const tenantId =
      await this.tenantModules.getEffectiveTenantId(createdByUserId);

    // Validar límite de usuarios del plan
    await this.planLimits.validateUserLimit(tenantId);

    const tempPassword = randomBytes(16).toString('hex');
    const passwordHash = await argon2.hash(tempPassword);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: dto.role ?? RoleName.USER,
        tenantId: tenantId ?? undefined,
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    await this.audit.logCreate('user', user.id, createdByUserId, {
      email: user.email,
      role: user.role,
      invite: true,
    });
    const inviteToken = await this.jwt.signAsync(
      { sub: user.id, type: 'invite' },
      { expiresIn: '7d' },
    );
    const isDev = process.env.NODE_ENV !== 'production';
    return isDev ? { user, inviteToken, tempPassword } : { user, inviteToken };
  }

  /** Aceptar invitación: establecer contraseña con el token recibido por correo (o en dev). */
  async acceptInvite(dto: AcceptInviteDto) {
    let payload: { sub?: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(
        dto.token,
      );
    } catch {
      throw new BadRequestException(
        'Enlace de invitación inválido o expirado.',
      );
    }
    if (payload.type !== 'invite' || !payload.sub) {
      throw new BadRequestException(
        'Enlace de invitación inválido o expirado.',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });
    if (!user)
      throw new BadRequestException(
        'Enlace de invitación inválido o expirado.',
      );

    const passwordHash = await argon2.hash(dto.password);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    try {
      await this.audit.log('auth', user.id, 'invite_accepted', user.id, {});
    } catch (auditErr) {
      console.error('Error al registrar auditoría invite_accepted:', auditErr);
    }
    return { success: true };
  }

  /** Lista usuarios del mismo tenant. Requiere users:read. Nunca incluye admins de plataforma (tenantId null). */
  async listUsers(tenantId: string | null) {
    const effectiveTenantId =
      tenantId ?? (await this.tenantModules.getDefaultTenantId());
    if (!effectiveTenantId) return [];
    return this.prisma.user.findMany({
      where: {
        AND: [
          { tenantId: effectiveTenantId },
          { tenantId: { not: null } },
          { isActive: true },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profilePictureUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Actualiza nombre, rol y/o contraseña de un usuario del mismo tenant. Requiere users:update. */
  async updateUser(userId: string, dto: UpdateUserDto, requestUserId: string) {
    if (dto.name == null && dto.role == null && dto.password == null) {
      throw new BadRequestException('Debe indicar nombre, rol y/o contraseña.');
    }
    const requestTenantId =
      await this.tenantModules.getEffectiveTenantId(requestUserId);
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });
    if (!target) throw new BadRequestException('Usuario no encontrado.');
    if (target.tenantId === null) {
      throw new ForbiddenException(
        'No se puede editar el administrador de plataforma.',
      );
    }
    const targetTenantId =
      target.tenantId ?? (await this.tenantModules.getDefaultTenantId());
    if (targetTenantId !== requestTenantId) {
      throw new BadRequestException('Usuario no encontrado.');
    }
    const data: { name?: string; role?: RoleName; passwordHash?: string } = {};
    if (dto.name !== undefined) data.name = dto.name.trim() || undefined;
    if (dto.role != null) data.role = dto.role;
    if (dto.password != null)
      data.passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    await this.audit.logUpdate('user', user.id, requestUserId, undefined, {
      name: user.name,
      role: user.role,
    });
    return user;
  }

  /** Desactiva (soft delete) un usuario del mismo tenant. Requiere users:delete. No se puede eliminar a uno mismo. */
  async deleteUser(userId: string, requestUserId: string) {
    if (userId === requestUserId) {
      throw new BadRequestException('No puedes eliminar tu propio usuario.');
    }
    const requestTenantId =
      await this.tenantModules.getEffectiveTenantId(requestUserId);
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, email: true },
    });
    if (!target) throw new BadRequestException('Usuario no encontrado.');
    if (target.tenantId === null) {
      throw new ForbiddenException(
        'No se puede eliminar el administrador de plataforma.',
      );
    }
    const targetTenantId =
      target.tenantId ?? (await this.tenantModules.getDefaultTenantId());
    if (targetTenantId !== requestTenantId) {
      throw new BadRequestException('Usuario no encontrado.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    await this.audit.logDelete('user', userId, requestUserId);
    return { success: true };
  }

  /** Cambiar contraseña del usuario actual. Cualquier usuario autenticado puede cambiar la suya. */
  async changeMyPassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado.');
    const ok = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!ok) throw new BadRequestException('Contraseña actual incorrecta.');
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    try {
      await this.audit.log('auth', user.id, 'password_changed', user.id, {});
    } catch (auditErr) {
      console.error('Error al registrar auditoría password_changed:', auditErr);
    }
    return { success: true };
  }

  /** Olvidé mi contraseña: genera token de restablecimiento (1h). No revela si el email existe. */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email, isActive: true },
      select: { id: true },
    });
    const message =
      'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';
    if (!user) return { message };

    const resetToken = await this.jwt.signAsync(
      { sub: user.id, type: 'password_reset' },
      { expiresIn: '1h' },
    );
    try {
      await this.audit.log(
        'auth',
        user.id,
        'forgot_password_requested',
        user.id,
        {},
      );
    } catch (auditErr) {
      console.error('Error al registrar auditoría forgot_password:', auditErr);
    }

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL')?.replace(/\/$/, '') || '';
    const resetLink = frontendUrl
      ? `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`
      : '';

    if (this.mailer.isConfigured() && resetLink) {
      const sent = await this.mailer.sendMail({
        to: email,
        subject: 'Restablecer contraseña',
        html: `
          <p>Hola,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el enlace (válido 1 hora):</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>Si no solicitaste esto, ignora este correo.</p>
        `,
        text: `Restablecer contraseña: ${resetLink}\nSi no solicitaste esto, ignora este correo.`,
      });
      if (!sent)
        console.error(
          'No se pudo enviar el correo de restablecimiento a',
          email,
        );
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const returnToken = isDev && !this.mailer.isConfigured();
    return returnToken ? { message, resetToken } : { message };
  }

  /** Restablecer contraseña con el token recibido por correo (o en dev). */
  async resetPassword(dto: ResetPasswordDto) {
    let payload: { sub?: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(
        dto.token,
      );
    } catch {
      throw new BadRequestException(
        'Enlace inválido o expirado. Solicita uno nuevo.',
      );
    }
    if (payload.type !== 'password_reset' || !payload.sub) {
      throw new BadRequestException(
        'Enlace inválido o expirado. Solicita uno nuevo.',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });
    if (!user)
      throw new BadRequestException(
        'Enlace inválido o expirado. Solicita uno nuevo.',
      );

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    try {
      await this.audit.log(
        'auth',
        user.id,
        'password_reset_completed',
        user.id,
        {},
      );
    } catch (auditErr) {
      console.error('Error al registrar auditoría password_reset:', auditErr);
    }
    return { success: true };
  }

  async login(dto: LoginDto) {
    try {
      return await this.loginInternal(dto);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      console.error('[AuthService.login] Error no controlado:', err);
      throw new InternalServerErrorException(
        process.env.NODE_ENV === 'production'
          ? 'Error al iniciar sesión. Intenta más tarde.'
          : message,
      );
    }
  }

  private async loginInternal(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        passwordHash: true,
        mustChangePassword: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) {
      try {
        await this.audit.logAuth('login_failed', null, { email });
      } catch (auditErr) {
        console.error('Error al registrar auditoría login_failed:', auditErr);
      }
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    // Restringir login: ALLOWED_LOGIN_EMAILS (lista) o, si no está definida, solo PLATFORM_ADMIN_EMAIL
    const allowedEmailsRaw = process.env.ALLOWED_LOGIN_EMAILS?.trim();
    let allowed: string[] = [];
    if (allowedEmailsRaw) {
      allowed = allowedEmailsRaw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    } else {
      const platformEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim();
      if (platformEmail) {
        allowed = [platformEmail.toLowerCase()];
      }
    }
    // En tests E2E (NODE_ENV=test) no restringir por lista de correos para permitir usuarios de test
    if (
      allowed.length > 0 &&
      process.env.NODE_ENV !== 'test' &&
      !allowed.includes(user.email.toLowerCase())
    ) {
      try {
        await this.audit.logAuth('login_failed', user.id, {
          email,
          reason: 'not_allowed',
        });
      } catch (auditErr) {
        console.error('Error al registrar auditoría login_failed:', auditErr);
      }
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    let ok = false;
    try {
      ok = await argon2.verify(user.passwordHash, dto.password);
    } catch (hashErr) {
      console.warn(
        '[AuthService.login] Error al verificar contraseña (hash inválido o corrupto):',
        hashErr,
      );
      try {
        await this.audit.logAuth('login_failed', user.id, { email });
      } catch (auditErr) {
        console.error('Error al registrar auditoría login_failed:', auditErr);
      }
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (!ok) {
      try {
        await this.audit.logAuth('login_failed', user.id, { email });
      } catch (auditErr) {
        console.error('Error al registrar auditoría login_failed:', auditErr);
      }
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const effectiveTenantId =
      user.tenantId ?? (await this.tenantModules.getDefaultTenantId());
    if (effectiveTenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: effectiveTenantId },
        select: { isActive: true },
      });
      if (tenant && !tenant.isActive) {
        throw new UnauthorizedException(
          'Cuenta suspendida. Contacte a soporte o facturación.',
        );
      }
    }
    const platformAdmin = this.isPlatformAdminUser(user.tenantId, user.email);
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role ?? RoleName.USER,
      tenantId: effectiveTenantId ?? undefined,
      isPlatformAdmin: platformAdmin,
    };
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      }),
      ...(effectiveTenantId
        ? [
            this.prisma.tenant.update({
              where: { id: effectiveTenantId },
              data: { lastActivityAt: now },
            }),
          ]
        : []),
    ]);
    try {
      await this.audit.logAuth('login', user.id, { email, role: user.role });
    } catch (auditErr) {
      console.error('Error al registrar auditoría de login:', auditErr);
    }
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      mustChangePassword: user.mustChangePassword ?? false,
      isPlatformAdmin: platformAdmin,
    };
  }

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        profilePictureUrl: true,
        tenant: {
          select: {
            id: true,
            name: true,
            plan: { select: { name: true, slug: true } },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado.');
    const permissions =
      await this.permissions.getEnabledPermissionsForUser(userId);
    const tenantId = user.tenantId ?? null;
    let enabledModules: string[] = [];
    try {
      enabledModules = await this.tenantModules.getEnabledModules(tenantId);
    } catch (err) {
      console.error('[AuthService.getMe] getEnabledModules error:', err);
    }

    const response: MeResponse = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profilePictureUrl: user.profilePictureUrl,
      },
      permissions,
      isPlatformAdmin: this.isPlatformAdminUser(user.tenantId, user.email),
    };
    if (user.tenant) {
      response.tenant = {
        id: user.tenant.id,
        name: user.tenant.name,
        plan: user.tenant.plan
          ? { name: user.tenant.plan.name, slug: user.tenant.plan.slug }
          : undefined,
        enabledModules,
      };
    } else if (enabledModules.length > 0) {
      response.tenant = {
        id: '',
        name: '',
        enabledModules,
      };
    }
    return response;
  }

  /**
   * Actualiza la foto de perfil del usuario actual.
   */
  async updateProfilePicture(
    userId: string,
    file: MulterFile,
  ): Promise<{ profilePictureUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profilePictureUrl: true },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    // Eliminar foto anterior si existe
    if (user.profilePictureUrl) {
      await this.storage.deleteFile(user.profilePictureUrl);
    }

    // Guardar nueva foto
    const profilePictureUrl = await this.storage.saveFile(file, 'profiles');

    // Actualizar en BD
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePictureUrl },
    });

    await this.audit.logUpdate(
      'user',
      userId,
      userId,
      { profilePictureUrl: user.profilePictureUrl },
      { profilePictureUrl },
    );

    return { profilePictureUrl };
  }

  /**
   * Obtiene los límites del plan del tenant (maxUsers, currentUsers, canAddUsers).
   */
  async getTenantLimits(tenantId: string | null) {
    return this.planLimits.getTenantLimits(tenantId);
  }

  /**
   * Actualiza la foto de perfil de un empleado (requiere permisos de administración).
   */
  async updateEmployeePicture(
    employeeId: string,
    file: MulterFile,
    requestUserId: string,
  ): Promise<{ profilePictureUrl: string }> {
    const requestTenantId =
      await this.tenantModules.getEffectiveTenantId(requestUserId);
    const employee = await this.prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, tenantId: true, profilePictureUrl: true },
    });

    if (!employee) {
      throw new BadRequestException('Empleado no encontrado.');
    }

    const employeeTenantId =
      employee.tenantId ?? (await this.tenantModules.getDefaultTenantId());
    if (employeeTenantId !== requestTenantId) {
      throw new BadRequestException('Empleado no encontrado.');
    }

    // Eliminar foto anterior si existe
    if (employee.profilePictureUrl) {
      await this.storage.deleteFile(employee.profilePictureUrl);
    }

    // Guardar nueva foto
    const profilePictureUrl = await this.storage.saveFile(file, 'profiles');

    // Actualizar en BD
    await this.prisma.user.update({
      where: { id: employeeId },
      data: { profilePictureUrl },
    });

    await this.audit.logUpdate(
      'user',
      employeeId,
      requestUserId,
      { profilePictureUrl: employee.profilePictureUrl },
      { profilePictureUrl },
    );

    return { profilePictureUrl };
  }
}
