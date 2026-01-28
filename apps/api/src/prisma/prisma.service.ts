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
      if (isProd) {
        throw new Error(
          'DATABASE_URL no configurada. En producción es obligatorio configurar la conexión a la base de datos.',
        );
      }
    }

    super({
      datasources: {
        db: {
          url:
            url ??
            'postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public',
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
