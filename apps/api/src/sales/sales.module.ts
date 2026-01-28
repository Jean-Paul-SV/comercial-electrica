import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { QueueModule } from '../queue/queue.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [QueueModule, CommonModule],
  providers: [SalesService],
  controllers: [SalesController],
})
export class SalesModule {}
