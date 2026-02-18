import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PayuController } from './payu.controller';
import { PayuService } from './payu.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  controllers: [PayuController],
  providers: [PayuService],
  exports: [PayuService],
})
export class PayuModule {}
