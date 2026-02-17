import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    /**
     * En teoría Prisma lee DATABASE_URL automáticamente desde el entorno,
     * pero en entornos de testing (Jest, herramientas, etc.) a veces la
     * variable no está lista cuando se inicializa el cliente.
     *
     * Para hacer el sistema más robusto, forzamos explícitamente la URL
     * del datasource, usando:
     * - process.env.DATABASE_URL si existe
     * - un valor por defecto alineado con env.example y docker-compose
     */
    const url = process.env.DATABASE_URL;
    const isProd = process.env.NODE_ENV === 'production';

    if (!url || url.trim().length === 0) {
      throw new Error(
        'DATABASE_URL no configurada. Configura esta variable de entorno en .env o en el entorno de ejecución.',
      );
    }

    // Configurar connection pooling según entorno
    // En producción: connection_limit=20-50, pool_timeout=20
    // En desarrollo: connection_limit=5, pool_timeout=10
    const connectionLimit = isProd ? 20 : 5;
    const poolTimeout = isProd ? 20 : 10;
    
    const urlWithPool = url.includes('?')
      ? `${url}&connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`
      : `${url}?connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;

    super({
      datasources: {
        db: {
          url: urlWithPool,
        },
      },
      log: isProd ? ['error', 'warn'] : ['query', 'error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
