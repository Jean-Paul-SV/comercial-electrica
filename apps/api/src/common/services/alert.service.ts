import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../mailer/mailer.service';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertPayload = {
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata?: Record<string, unknown>;
  tenantId?: string;
  tenantName?: string;
};

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {}

  /**
   * Envía una alerta a todos los canales configurados (Slack, Email, Webhook).
   */
  async sendAlert(payload: AlertPayload): Promise<void> {
    const promises: Promise<void>[] = [];

    // Slack
    if (this.isSlackEnabled()) {
      promises.push(this.sendToSlack(payload).catch((err) => {
        this.logger.error('Error enviando alerta a Slack:', err);
      }));
    }

    // Email (solo para críticas)
    if (payload.severity === 'critical' && this.mailer.isConfigured()) {
      promises.push(this.sendToEmail(payload).catch((err) => {
        this.logger.error('Error enviando alerta por email:', err);
      }));
    }

    // Webhook
    if (this.isWebhookEnabled()) {
      promises.push(this.sendToWebhook(payload).catch((err) => {
        this.logger.error('Error enviando alerta a webhook:', err);
      }));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Envía alerta a Slack usando webhook.
   */
  private async sendToSlack(payload: AlertPayload): Promise<void> {
    const webhookUrl = this.config.get<string>('SLACK_WEBHOOK_URL');
    if (!webhookUrl) return;

    const color = this.getSeverityColor(payload.severity);
    const emoji = this.getSeverityEmoji(payload.severity);

    const slackPayload = {
      text: `${emoji} ${payload.title}`,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Mensaje',
              value: payload.message,
              short: false,
            },
            ...(payload.tenantName
              ? [
                  {
                    title: 'Tenant',
                    value: payload.tenantName,
                    short: true,
                  },
                ]
              : []),
            {
              title: 'Severidad',
              value: payload.severity.toUpperCase(),
              short: true,
            },
            ...(payload.metadata
              ? Object.entries(payload.metadata).map(([key, value]) => ({
                  title: key,
                  value: String(value),
                  short: true,
                }))
              : []),
          ],
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`);
    }
  }

  /**
   * Envía alerta por email (solo críticas).
   */
  private async sendToEmail(payload: AlertPayload): Promise<void> {
    const alertEmail = this.config.get<string>('ALERT_EMAIL');
    if (!alertEmail) {
      this.logger.warn('ALERT_EMAIL no configurado, omitiendo envío por email');
      return;
    }

    const subject = `[${payload.severity.toUpperCase()}] ${payload.title}`;
    const html = `
      <h2>${payload.title}</h2>
      <p><strong>Severidad:</strong> ${payload.severity.toUpperCase()}</p>
      <p>${payload.message}</p>
      ${payload.tenantName ? `<p><strong>Tenant:</strong> ${payload.tenantName}</p>` : ''}
      ${payload.metadata
        ? `<h3>Detalles:</h3><pre>${JSON.stringify(payload.metadata, null, 2)}</pre>`
        : ''}
      <hr>
      <p><small>Orion Alert System</small></p>
    `;

    const text = `
${payload.title}
Severidad: ${payload.severity.toUpperCase()}

${payload.message}

${payload.tenantName ? `Tenant: ${payload.tenantName}\n` : ''}
${payload.metadata ? `Detalles:\n${JSON.stringify(payload.metadata, null, 2)}` : ''}

---
Orion Alert System
    `.trim();

    await this.mailer.sendMail({
      to: alertEmail,
      subject,
      html,
      text,
    });
  }

  /**
   * Envía alerta a webhook externo.
   */
  private async sendToWebhook(payload: AlertPayload): Promise<void> {
    const webhookUrl = this.config.get<string>('ALERT_WEBHOOK_URL');
    if (!webhookUrl) return;

    const webhookPayload = {
      timestamp: new Date().toISOString(),
      title: payload.title,
      message: payload.message,
      severity: payload.severity,
      tenantId: payload.tenantId,
      tenantName: payload.tenantName,
      metadata: payload.metadata,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.get<string>('ALERT_WEBHOOK_SECRET')
          ? {
              'X-Webhook-Secret': this.config.get<string>('ALERT_WEBHOOK_SECRET')!,
            }
          : {}),
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
  }

  /**
   * Verifica si Slack está habilitado.
   */
  private isSlackEnabled(): boolean {
    return !!this.config.get<string>('SLACK_WEBHOOK_URL');
  }

  /**
   * Verifica si webhook está habilitado.
   */
  private isWebhookEnabled(): boolean {
    return !!this.config.get<string>('ALERT_WEBHOOK_URL');
  }

  /**
   * Obtiene el color de Slack según severidad.
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return 'danger'; // Rojo
      case 'warning':
        return 'warning'; // Amarillo
      case 'info':
        return 'good'; // Verde
      default:
        return '#36a64f';
    }
  }

  /**
   * Obtiene el emoji según severidad.
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  }
}
