import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '@prisma/client';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';

export type JwtPayload = {
  sub: string;
  email: string;
  role: RoleName;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async bootstrapAdmin(dto: BootstrapAdminDto) {
    const count = await this.prisma.user.count();
    if (count > 0) {
      throw new BadRequestException('Bootstrap ya fue realizado.');
    }
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: RoleName.ADMIN,
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    return user;
  }

  async register(dto: RegisterUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email ya registrado.');
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: dto.role ?? RoleName.USER,
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    return user;
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Credenciales inválidas.');
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas.');

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken };
  }
}

