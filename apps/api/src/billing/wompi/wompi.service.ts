import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import type {
  CreateWompiTransactionDto,
  WompiPaymentMethodType,
} from './dto/create-wompi-transaction.dto';
import { BillingService } from '../billing.service';

const WOMPI_SANDBOX = 'https://sandbox.wompi.co/v1';
const WOMPI_PRODUCTION = 'https://production.wompi.co/v1';

interface WompiTransactionPayload {
  acceptance_token: string;
  accept_personal_auth: string;
  amount_in_cents: number;
  currency: string;
  customer_email: string;
  reference: string;
  signature: string;
  payment_method_type: string;
  payment_method: Record<string, unknown>;
  redirect_url?: string;
  customer_data?: { full_name?: string; phone_number?: string };
  ip?: string;
}

interface WompiApiTransaction {
  data?: {
    id: string;
    status: string;
    status_message?: string;
    payment_method?: {
      type?: string;
      extra?: { async_payment_url?: string; url?: string };
    };
  };
}

@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);
  private readonly privateKey: string | null;
  private readonly publicKey: string | null;
  private readonly integritySecret: string | null;
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {
    this.privateKey = this.config.get<string>('WOMPI_PRIVATE_KEY') ?? null;
    this.publicKey = this.config.get<string>('WOMPI_PUBLIC_KEY') ?? null;
    this.integritySecret =
      this.config.get<string>('WOMPI_INTEGRITY_SECRET') ?? null;
    const useSandbox =
      this.privateKey?.startsWith('priv_test_') ??
      !this.config.get<string>('WOMPI_USE_PRODUCTION');
    this.baseUrl =
      this.config.get<string>('WOMPI_BASE_URL') ??
      (useSandbox ? WOMPI_SANDBOX : WOMPI_PRODUCTION);
  }

  isConfigured(): boolean {
    return !!(
      this.privateKey &&
      this.publicKey &&
      this.integritySecret
    );
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  /** Firma de integridad: SHA256(reference + amount_in_cents + currency + integritySecret) */
  buildSignature(
    reference: string,
    amountInCents: number,
    currency: string,
  ): string {
    if (!this.integritySecret) {
      throw new BadRequestException('Wompi no configurado (integridad).');
    }
    const str = `${reference}${amountInCents}${currency}${this.integritySecret}`;
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /** Obtener tokens de aceptación para el comercio (para enviar al front). */
  async getMerchantAcceptanceTokens(): Promise<{
    acceptance_token: string;
    accept_personal_auth: string;
    permalink_terms: string;
    permalink_personal_data: string;
  }> {
    if (!this.publicKey) {
      throw new BadRequestException('Wompi no configurado (llave pública).');
    }
    const url = `${this.baseUrl}/merchants/${this.publicKey}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      this.logger.warn(`Wompi merchants: ${res.status} ${await res.text()}`);
      throw new BadRequestException(
        'No se pudieron obtener los tokens de aceptación de Wompi.',
      );
    }
    const json = (await res.json()) as {
      data?: {
        presigned_acceptance?: {
          acceptance_token: string;
          permalink: string;
          type: string;
        };
        presigned_personal_data_auth?: {
          acceptance_token: string;
          permalink: string;
          type: string;
        };
      };
    };
    const acceptance = json.data?.presigned_acceptance;
    const personalAuth = json.data?.presigned_personal_data_auth;
    if (!acceptance?.acceptance_token || !personalAuth?.acceptance_token) {
      throw new BadRequestException(
        'Respuesta de Wompi sin tokens de aceptación.',
      );
    }
    return {
      acceptance_token: acceptance.acceptance_token,
      accept_personal_auth: personalAuth.acceptance_token,
      permalink_terms: acceptance.permalink ?? '',
      permalink_personal_data: personalAuth.permalink ?? '',
    };
  }

  /**
   * Crear transacción en Wompi para pagar suscripción.
   * Asigna plan al tenant en PENDING_PAYMENT, crea Payment WOMPI PENDING, llama a Wompi y devuelve id + async_payment_url si aplica.
   */
  async createSubscriptionTransaction(
    tenantId: string,
    dto: CreateWompiTransactionDto,
    clientIp?: string,
  ): Promise<{
    transactionId: string;
    status: string;
    async_payment_url?: string;
    status_message?: string;
  }> {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Wompi no está configurado. Configure WOMPI_PRIVATE_KEY, WOMPI_PUBLIC_KEY y WOMPI_INTEGRITY_SECRET.',
      );
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
      select: {
        id: true,
        name: true,
        priceMonthly: true,
        priceYearly: true,
      },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }

    const amount =
      dto.billingInterval === 'yearly' && plan.priceYearly != null
        ? Number(plan.priceYearly)
        : Number(plan.priceMonthly ?? plan.priceYearly ?? 0);
    if (amount <= 0) {
      throw new BadRequestException(
        'El plan no tiene precio configurado para el intervalo seleccionado.',
      );
    }
    const amountInCents = Math.round(amount);

    const reference = `sub_${tenantId}_${dto.planId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const signature = this.buildSignature(reference, amountInCents, 'COP');

    const paymentMethod: Record<string, unknown> = {
      ...(dto.payment_method as Record<string, unknown>),
    };
    const payload: WompiTransactionPayload = {
      acceptance_token: dto.acceptance_token,
      accept_personal_auth: dto.accept_personal_auth,
      amount_in_cents: amountInCents,
      currency: 'COP',
      customer_email: dto.customer_email,
      reference,
      signature,
      payment_method_type: dto.payment_method_type,
      payment_method: paymentMethod,
      redirect_url: this.config.get<string>('FRONTEND_URL')
        ? `${this.config.get<string>('FRONTEND_URL')!.replace(/\/$/, '')}/settings/billing?wompi=1`
        : undefined,
    };
    if (dto.customer_full_name || dto.customer_phone) {
      payload.customer_data = {};
      if (dto.customer_full_name)
        payload.customer_data.full_name = dto.customer_full_name;
      if (dto.customer_phone)
        payload.customer_data.phone_number = dto.customer_phone;
    }
    if (clientIp) payload.ip = clientIp;

    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true, tenant: true },
    });
    if (!subscription) {
      throw new NotFoundException('No hay suscripción para esta empresa.');
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        provider: 'WOMPI',
        status: 'PENDING',
        amount,
        currency: 'COP',
        purpose: 'SUBSCRIPTION',
        metadata: {
          planId: dto.planId,
          billingInterval: dto.billingInterval,
          reference,
        },
      },
    });

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { tenantId },
        data: {
          planId: dto.planId,
          status: 'PENDING_PAYMENT',
          updatedAt: new Date(),
        },
      }),
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          planId: dto.planId,
          billingInterval: dto.billingInterval,
          updatedAt: new Date(),
        },
      }),
    ]);

    const res = await fetch(`${this.baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.privateKey}`,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = (await res.json()) as WompiApiTransaction & {
      error?: string;
    };
    if (!res.ok) {
      this.logger.warn(
        `Wompi create transaction: ${res.status} ${JSON.stringify(responseBody)}`,
      );
      throw new BadRequestException(
        responseBody.error ?? 'Error al crear la transacción en Wompi.',
      );
    }

    const data = responseBody.data;
    if (!data?.id) {
      throw new BadRequestException(
        'Wompi no devolvió ID de transacción.',
      );
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { externalId: data.id, updatedAt: new Date() },
    });

    const asyncUrl =
      data.payment_method?.extra?.async_payment_url ??
      data.payment_method?.extra?.url;

    return {
      transactionId: data.id,
      status: data.status ?? 'PENDING',
      async_payment_url: asyncUrl,
      status_message: data.status_message,
    };
  }

  /**
   * Consultar estado de una transacción en Wompi y, si está APPROVED, activar la suscripción.
   */
  async getTransactionAndConfirmIfApproved(
    transactionId: string,
    tenantId: string,
  ): Promise<{
    status: string;
    status_message?: string;
    async_payment_url?: string;
    activated?: boolean;
  }> {
    if (!this.privateKey) {
      throw new BadRequestException('Wompi no configurado.');
    }
    const res = await fetch(
      `${this.baseUrl}/transactions/${encodeURIComponent(transactionId)}`,
      {
        headers: { Authorization: `Bearer ${this.privateKey}` },
      },
    );
    const json = (await res.json()) as WompiApiTransaction;
    if (!res.ok || !json.data) {
      throw new NotFoundException(
        'Transacción no encontrada o error en Wompi.',
      );
    }
    const data = json.data;
    const status = data.status ?? 'PENDING';
    const asyncUrl =
      data.payment_method?.extra?.async_payment_url ??
      data.payment_method?.extra?.url;

    if (status === 'APPROVED') {
      const payment = await this.prisma.payment.findFirst({
        where: {
          tenantId,
          provider: 'WOMPI',
          externalId: transactionId,
          purpose: 'SUBSCRIPTION',
        },
      });
      if (payment && payment.status !== 'APPROVED') {
        const meta = (payment.metadata as Record<string, unknown>) ?? {};
        const planId = meta.planId as string | undefined;
        const billingInterval = (meta.billingInterval as 'monthly' | 'yearly') ?? 'yearly';
        if (planId) {
          await this.billing.activateSubscriptionFromWompiPayment(
            tenantId,
            planId,
            billingInterval,
            transactionId,
          );
        }
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'APPROVED', updatedAt: new Date() },
        });
        return {
          status,
          status_message: data.status_message,
          async_payment_url: asyncUrl,
          activated: true,
        };
      }
    }

    return {
      status,
      status_message: data.status_message,
      async_payment_url: asyncUrl,
    };
  }
}
