import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditController } from './audit.controller';
import { AuditService } from '../common/services/audit.service';
import { ArchiveService } from './archive.service';
import { ArchiveScheduler } from './archive.scheduler';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, ConfigModule, PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, ArchiveService, ArchiveScheduler],
})
export class AuditModule {}
