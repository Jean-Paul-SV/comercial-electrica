import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [TenantController],
})
export class TenantModule {}
