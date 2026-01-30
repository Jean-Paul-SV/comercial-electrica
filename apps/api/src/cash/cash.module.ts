import { Module } from '@nestjs/common';
import { CashService } from './cash.service';
import { CashController } from './cash.controller';
import { CashMovementsController } from './cash-movements.controller';

@Module({
  providers: [CashService],
  controllers: [CashController, CashMovementsController],
})
export class CashModule {}
