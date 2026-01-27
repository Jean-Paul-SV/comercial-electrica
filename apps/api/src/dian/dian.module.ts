import { Module } from '@nestjs/common';
import { DianService } from './dian.service';
import { DianProcessor } from './dian.processor';
import { DianController } from './dian.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, QueueModule, ConfigModule],
  controllers: [DianController],
  providers: [DianService, DianProcessor],
  exports: [DianService],
})
export class DianModule {}
