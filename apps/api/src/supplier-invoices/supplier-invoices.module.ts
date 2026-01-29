import { Module } from '@nestjs/common';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { SupplierInvoicesController } from './supplier-invoices.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [SupplierInvoicesService],
  controllers: [SupplierInvoicesController],
  exports: [SupplierInvoicesService],
})
export class SupplierInvoicesModule {}
