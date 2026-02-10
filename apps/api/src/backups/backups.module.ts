import { Module } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { BackupsController } from './backups.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformAdminGuard } from '../provider/platform-admin.guard';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [BackupsService, PlatformAdminGuard],
  controllers: [BackupsController],
})
export class BackupsModule {}
