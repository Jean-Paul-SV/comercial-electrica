import { Module } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { BackupsController } from './backups.controller';
import { BackupValidationService } from './backup-validation.service';
import { BackupValidationScheduler } from './backup-validation.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [
    BackupsService,
    BackupValidationService,
    BackupValidationScheduler,
  ],
  controllers: [BackupsController],
  exports: [BackupsService, BackupValidationService],
})
export class BackupsModule {}
