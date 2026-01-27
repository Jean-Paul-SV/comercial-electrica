import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  getHello(): string {
    return 'Sistema Comercial Eléctrica API - Bienvenido!';
  }

  getHealth() {
    const uptime = (Date.now() - this.startTime) / 1000; // en segundos

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    };
  }
}
