import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CashService } from './cash.service';
import { CashController } from './cash.controller';
import { CashMovementsController } from './cash-movements.controller';

@Module({
  imports: [AuthModule],
  providers: [CashService],
  controllers: [CashController, CashMovementsController],
})
export class CashModule {}
