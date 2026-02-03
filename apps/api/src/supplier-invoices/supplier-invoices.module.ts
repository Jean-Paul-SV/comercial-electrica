import { Module } from '@nestjs/common';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { SupplierInvoicesController } from './supplier-invoices.controller';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CommonModule, AuthModule],
  providers: [SupplierInvoicesService],
  controllers: [SupplierInvoicesController],
  exports: [SupplierInvoicesService],
})
export class SupplierInvoicesModule {}
