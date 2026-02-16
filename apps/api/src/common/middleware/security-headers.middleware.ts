import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Middleware para agregar headers de seguridad HTTP.
 * Protege contra ataques comunes como XSS, clickjacking, MIME sniffing, etc.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';

    // X-Content-Type-Options: previene MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options: previene clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // X-XSS-Protection: protección básica contra XSS (legacy, pero útil)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy: controla qué información del referrer se envía
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy: controla qué APIs del navegador pueden usar
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );

    // Content-Security-Policy: política de seguridad de contenido
    // En producción, ajustar según necesidades
    if (isProd) {
      // CSP estricto para producción
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;",
      );
    } else {
      // CSP más permisivo para desarrollo (permite Swagger, etc.)
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: http://localhost:* ws://localhost:* ws:;",
      );
    }

    // Strict-Transport-Security (HSTS): solo en producción con HTTPS
    if (isProd && req.secure) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    // X-Powered-By: ocultar información del servidor
    res.removeHeader('X-Powered-By');

    next();
  }
}
