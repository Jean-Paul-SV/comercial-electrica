import { Module } from '@nestjs/common';
import { DianService } from './dian.service';
import { DianProcessor } from './dian.processor';
import { DianController } from './dian.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ConfigModule } from '@nestjs/config';

const enableDianProcessor =
  process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID;

@Module({
  imports: [PrismaModule, QueueModule, ConfigModule],
  controllers: [DianController],
  providers: [DianService, ...(enableDianProcessor ? [DianProcessor] : [])],
  exports: [DianService],
})
export class DianModule {}
