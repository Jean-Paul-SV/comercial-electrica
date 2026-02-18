import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

type PaymentProvider = 'STRIPE' | 'PAYU';
type PaymentStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'REFUNDED';

const PAYU_PROVIDER: PaymentProvider = 'PAYU';

const PAYU_GATEWAY_SANDBOX = 'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/';
const PAYU_GATEWAY_PROD = 'https://checkout.payulatam.com/ppp-web-gateway-payu/';

export interface CreatePayuPaymentInput {
  amount: number;
  currency?: string;
  purpose?: string;
  returnUrl?: string;
  customerEmail: string;
  customerName?: string;
  /** Documento del comprador (CC, NIT, etc.). Por defecto CC. */
  buyerDocumentType?: string;
  /** Número de documento. Obligatorio en PayU. */
  buyerDocument?: string;
  /** Teléfono. Por defecto placeholder. */
  buyerPhone?: string;
  metadata?: Record<string, unknown>;
}

export interface PayuPaymentResponse {
  paymentId: string;
  checkoutUrl: string;
  /** Campos para enviar por POST al checkoutUrl (formulario WebCheckout). */
  formData: Record<string, string>;
}

@Injectable()
export class PayuService {
  private readonly logger = new Logger(PayuService.name);
  private readonly apiKey: string | null;
  private readonly merchantId: string | null;
  private readonly accountId: string | null;
  private readonly test: boolean;
  private readonly confirmationUrl: string | null;
  private readonly gatewayUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.config.get<string>('PAYU_API_KEY') ?? null;
    this.merchantId = this.config.get<string>('PAYU_MERCHANT_ID') ?? null;
    this.accountId = this.config.get<string>('PAYU_ACCOUNT_ID') ?? null;
    this.test = this.config.get<string>('PAYU_TEST', 'true') === 'true';
    this.confirmationUrl = this.config.get<string>('PAYU_CONFIRMATION_URL') ?? null;
    this.gatewayUrl = this.test ? PAYU_GATEWAY_SANDBOX : PAYU_GATEWAY_PROD;
  }

  /**
   * Firma para WebCheckout: MD5(apiKey~merchantId~referenceCode~amount~currency)
   * amount sin decimales o con dos decimales.
   */
  private buildSignature(referenceCode: string, amount: number, currency: string): string {
    if (!this.apiKey || !this.merchantId) return '';
    const amountStr = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    const str = `${this.apiKey}~${this.merchantId}~${referenceCode}~${amountStr}~${currency}`;
    return crypto.createHash('md5').update(str).digest('hex');
  }

  async createPaymentForTenant(
    input: CreatePayuPaymentInput,
    tenantId: string,
    createdByUserId?: string | null,
  ): Promise<PayuPaymentResponse> {
    const currency = (input.currency || 'COP').toUpperCase();

    const prismaAny = this.prisma as any;

    const payment = await prismaAny.payment.create({
      data: {
        tenantId,
        provider: PAYU_PROVIDER,
        status: 'PENDING' as PaymentStatus,
        amount: input.amount,
        currency,
        purpose: input.purpose ?? null,
        metadata: { ...(input.metadata ?? {}), referenceCode: '' },
        createdById: createdByUserId ?? null,
      },
    });

    const referenceCode = payment.id.replace(/-/g, '');
    await prismaAny.payment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          ...(payment.metadata ?? {}),
          referenceCode,
        },
      },
    });

    const amountForm = Number.isInteger(input.amount) ? input.amount : Math.round(input.amount * 100) / 100;
    const taxRate = 0.19;
    const taxReturnBase = Math.round((amountForm / (1 + taxRate)) * 100) / 100;
    const tax = Math.round((amountForm - taxReturnBase) * 100) / 100;

    const fullName = (input.customerName || 'Cliente').trim().slice(0, 150);
    const email = (input.customerEmail || '').trim().slice(0, 255);
    const phone = (input.buyerPhone || '3000000000').trim().slice(0, 20);
    const docType = (input.buyerDocumentType || 'CC').trim().slice(0, 25);
    const doc = (input.buyerDocument || '123456789').trim().slice(0, 25);

    const signature = this.buildSignature(referenceCode, amountForm, currency);

    const formData: Record<string, string> = {
      merchantId: this.merchantId || '',
      accountId: this.accountId || '',
      description: (input.purpose || `Pago ${referenceCode}`).slice(0, 255),
      referenceCode,
      amount: String(amountForm),
      tax: String(tax),
      taxReturnBase: String(taxReturnBase),
      currency,
      signature,
      test: this.test ? '1' : '0',
      buyerFullName: fullName,
      buyerEmail: email,
      buyerDocumentType: docType,
      buyerDocument: doc,
      telephone: phone,
      payerFullName: fullName,
      payerEmail: email,
      payerPhone: phone,
      payerDocumentType: docType,
      payerDocument: doc,
      shippingCountry: 'CO',
      shippingCity: 'Bogotá',
      shippingAddress: 'N/A',
    };

    if (input.returnUrl) {
      formData.responseUrl = input.returnUrl;
    }
    if (this.confirmationUrl) {
      formData.confirmationUrl = this.confirmationUrl;
    }

    this.logger.log('Pago PayU creado', {
      paymentId: payment.id,
      tenantId,
      amount: input.amount,
      currency,
      referenceCode,
    });

    return {
      paymentId: payment.id,
      checkoutUrl: this.gatewayUrl,
      formData,
    };
  }

  /**
   * Webhook de confirmación PayU. PayU envía POST a confirmationUrl con los parámetros de la transacción.
   * Estructura típica: state, referenceCode, transactionId, value, currency, etc.
   */
  async handleConfirmation(payload: Record<string, unknown>): Promise<void> {
    const state = String(payload?.state ?? payload?.transactionState ?? '').toUpperCase();
    const referenceCode = (payload?.referenceCode ?? payload?.reference_sale ?? '') as string;
    const transactionId = (payload?.transactionId ?? payload?.transaction_id ?? '') as string;

    if (!referenceCode) {
      this.logger.warn('Confirmación PayU sin referenceCode, ignorando');
      return;
    }

    const prismaAny = this.prisma as any;

    const idFromReference =
      referenceCode.length === 32
        ? `${referenceCode.slice(0, 8)}-${referenceCode.slice(8, 12)}-${referenceCode.slice(12, 16)}-${referenceCode.slice(16, 20)}-${referenceCode.slice(20, 32)}`
        : null;

    const payment =
      (idFromReference
        ? await prismaAny.payment.findFirst({
            where: { provider: PAYU_PROVIDER, id: idFromReference },
          })
        : null) ||
      (await prismaAny.payment.findFirst({
        where: {
          provider: PAYU_PROVIDER,
          metadata: { path: ['referenceCode'], equals: referenceCode },
        },
      }));

    if (!payment) {
      this.logger.warn(`No se encontró Payment PayU con referenceCode=${referenceCode}`);
      return;
    }

    await this.applyConfirmation(payment, state, transactionId, prismaAny);
  }

  private async applyConfirmation(
    payment: any,
    state: string,
    transactionId: string,
    prismaAny: any,
  ): Promise<void> {
    const mappedStatus = this.mapPayuStateToPaymentStatus(state);

    if (payment.status === mappedStatus) {
      this.logger.log('Confirmación PayU idempotente', { paymentId: payment.id, state });
      return;
    }

    await prismaAny.payment.update({
      where: { id: payment.id },
      data: {
        status: mappedStatus,
        externalId: transactionId || payment.externalId,
        updatedAt: new Date(),
        metadata: {
          ...(payment.metadata ?? {}),
          payuState: state,
        },
      },
    });

    this.logger.log('Pago PayU actualizado', {
      paymentId: payment.id,
      transactionId,
      state,
      status: mappedStatus,
    });

    if (mappedStatus === 'APPROVED') {
      await this.activateAddOnIfNeeded(payment, prismaAny);
    }
  }

  private mapPayuStateToPaymentStatus(state: string): PaymentStatus {
    const s = state.toUpperCase();
    if (s === 'APPROVED' || s === 'PENDING') return s === 'APPROVED' ? 'APPROVED' : 'PENDING';
    if (s === 'DECLINED' || s === 'REJECTED' || s === 'EXPIRED') return 'DECLINED';
    if (s === 'REFUNDED' || s === 'VOIDED') return 'REFUNDED';
    return 'PENDING';
  }

  private async activateAddOnIfNeeded(payment: any, prismaAny: any): Promise<void> {
    const purpose: string | null = payment?.purpose ?? null;
    if (!purpose) return;

    const [kind, value] = String(purpose).split(':', 2);
    if (kind !== 'ADDON' || !value) return;

    const moduleCode = value;
    const addOn = await prismaAny.addOn.findUnique({ where: { moduleCode } });

    if (!addOn) {
      this.logger.warn(`Pago PayU aprobado con purpose=${purpose}, pero no existe AddOn con moduleCode=${moduleCode}`);
      return;
    }

    await prismaAny.tenantAddOn.upsert({
      where: {
        tenantId_addOnId: { tenantId: payment.tenantId, addOnId: addOn.id },
      },
      update: { validUntil: null },
      create: { tenantId: payment.tenantId, addOnId: addOn.id },
    });

    this.logger.log('AddOn activado vía pago PayU', {
      tenantId: payment.tenantId,
      addOnId: addOn.id,
      moduleCode,
      paymentId: payment.id,
    });
  }
}
