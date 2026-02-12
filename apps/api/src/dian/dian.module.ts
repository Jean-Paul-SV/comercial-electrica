import { Module } from '@nestjs/common';
import { DianService } from './dian.service';
import { DianProcessor } from './dian.processor';
import { DianController } from './dian.controller';
import { DianAlertsScheduler } from './dian-alerts.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';

const enableDianProcessor =
  process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID;

@Module({
  imports: [PrismaModule, QueueModule, ConfigModule, CommonModule, AuthModule],
  controllers: [DianController],
  providers: [
    DianService,
    ...(enableDianProcessor ? [DianProcessor, DianAlertsScheduler] : []),
  ],
  exports: [DianService],
})
export class DianModule {}
