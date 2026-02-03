import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from './permissions.guard';
import { TenantModulesService } from './tenant-modules.service';
import { ModulesGuard } from './modules.guard';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET', 'CHANGE_ME_access'),
        signOptions: {
          expiresIn: Number(config.get('JWT_ACCESS_TTL_SECONDS', 900)),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PermissionsService,
    PermissionsGuard,
    TenantModulesService,
    ModulesGuard,
    TenantContextInterceptor,
  ],
  exports: [
    AuthService,
    PermissionsService,
    PermissionsGuard,
    TenantModulesService,
    ModulesGuard,
    TenantContextInterceptor,
  ],
})
export class AuthModule {}
