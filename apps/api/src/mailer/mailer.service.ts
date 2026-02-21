import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Servicio de correo opcional. Si no se configuran SMTP_* en .env, los métodos no envían nada
 * (útil en desarrollo o cuando el envío se hace por otro medio).
 */
@Injectable()
export class MailerService {
  private transporter: Transporter | null = null;
  private fromAddress: string = '';

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const portRaw = this.config.get<string>('SMTP_PORT');
    const port = portRaw ? parseInt(String(portRaw), 10) : 587;
    const numPort = Number.isNaN(port) ? 587 : port;
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM');
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: numPort,
        secure: numPort === 465,
        requireTLS: numPort === 587,
        auth: { user, pass },
      });
      this.fromAddress = from || user;
    } else {
      this.transporter = null;
    }
  }

  /** Indica si el envío por SMTP está configurado. */
  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /**
   * Envía un correo. Si SMTP no está configurado, no hace nada y devuelve false.
   */
  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
      console.error(`MailerService.sendMail error: ${msg}${code ? ` (code: ${code})` : ''}`);
      return false;
    }
  }
}
