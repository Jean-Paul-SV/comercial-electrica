import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { resolve } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustomersModule } from './customers/customers.module';
import { InventoryModule } from './inventory/inventory.module';
import { CashModule } from './cash/cash.module';
import { SalesModule } from './sales/sales.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Cargar .env desde la raíz del proyecto
      // Intenta diferentes ubicaciones posibles
      envFilePath: [
        resolve(process.cwd(), '../../.env'), // Desde apps/api/
        resolve(process.cwd(), '../.env'),    // Desde apps/
        resolve(process.cwd(), '.env'),        // Desde raíz
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
    AuthModule,
    CatalogModule,
    CustomersModule,
    InventoryModule,
    CashModule,
    SalesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
