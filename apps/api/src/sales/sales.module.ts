import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [SalesService],
  controllers: [SalesController],
})
export class SalesModule {}
