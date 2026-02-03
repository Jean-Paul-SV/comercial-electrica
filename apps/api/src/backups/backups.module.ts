import { Module } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { BackupsController } from './backups.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [BackupsService],
  controllers: [BackupsController],
})
export class BackupsModule {}
