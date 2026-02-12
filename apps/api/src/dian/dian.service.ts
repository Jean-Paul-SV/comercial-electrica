import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DianDocumentStatus,
  DianEnvironment,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';

/** URLs por defecto DIAN. Ref: documentación técnica DIAN. */
const DIAN_DEFAULT_BASE_URL_HAB = 'https://vpfe-hab.dian.gov.co';
const DIAN_DEFAULT_BASE_URL_PROD = 'https://vpfe.dian.gov.co';
const DIAN_SEND_PATH = '/WcfDianCustomerServices.svc';
const DIAN_SOAP_ACTION_RECEIVE = 'http://wcf.dian.colombia/IWcfDianCustomerServices/ReceiveInvoice';
const DIAN_HTTP_TIMEOUT_MS = 30_000;
const DIAN_HTTP_MAX_RETRIES = 3;
const DIAN_HTTP_RETRY_DELAY_MS = 5_000;
import { AuditService } from '../common/services/audit.service';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

/** Algoritmos DIAN: RSA-SHA256, SHA256, C14N exclusivo. Ref: Anexo Técnico FE 1.9 */
const DIAN_SIGNATURE_ALG = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const DIAN_DIGEST_ALG = 'http://www.w3.org/2001/04/xmlenc#sha256';
const DIAN_C14N_ALG = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const DIAN_TRANSFORM_ENVELOPED =
  'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/**
 * Servicio para procesamiento de documentos DIAN
 *
 * Responsabilidades:
 * - Generar XML según estándar DIAN
 * - Firmar documentos digitalmente
 * - Enviar documentos a DIAN
 * - Procesar respuestas de DIAN
 * - Generar PDFs de facturas
 */
@Injectable()
export class DianService {
  private readonly logger = new Logger(DianService.name);
  private readonly dianEnv: DianEnvironment;
  private readonly softwareId: string;
  private readonly softwarePin: string;
  private readonly certPath: string;
  private readonly certPassword: string;
  private readonly isTestEnv =
    process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    // Cargar configuración desde variables de entorno
    this.dianEnv =
      (this.config.get<string>(
        'DIAN_ENV',
        'HABILITACION',
      ) as DianEnvironment) || DianEnvironment.HABILITACION;
    this.softwareId = this.config.get<string>('DIAN_SOFTWARE_ID', '') || '';
    this.softwarePin = this.config.get<string>('DIAN_SOFTWARE_PIN', '') || '';
    this.certPath = this.config.get<string>('DIAN_CERT_PATH', '') || '';
    // En producción, inyectar DIAN_CERT_PASSWORD desde un gestor de secretos (AWS Secrets Manager, Vault, etc.)
    this.certPassword = this.config.get<string>('DIAN_CERT_PASSWORD', '') || '';

    if (!this.softwareId || !this.softwarePin) {
      this.logger.warn(
        '⚠️ DIAN_SOFTWARE_ID o DIAN_SOFTWARE_PIN no configurados. El procesamiento DIAN no funcionará.',
      );
    }
    if (!this.certPath || !this.certPassword) {
      this.logger.warn(
        '⚠️ DIAN_CERT_PATH o DIAN_CERT_PASSWORD no configurados. Los documentos se enviarán sin firma digital.',
      );
    }
  }

  /**
   * Procesa un documento DIAN completo:
   * 1. Genera XML
   * 2. Firma el documento
   * 3. Envía a DIAN
   * 4. Procesa la respuesta
   */
  async processDocument(dianDocumentId: string): Promise<void> {
    this.logger.log(`Procesando documento DIAN: ${dianDocumentId}`);

    const dianDoc = await this.prisma.dianDocument.findUnique({
      where: { id: dianDocumentId },
      include: {
        invoice: {
          include: {
            sale: {
              include: {
                items: {
                  include: { product: true },
                },
                customer: true,
              },
            },
            customer: true,
          },
        },
      },
    });

    if (!dianDoc) {
      throw new NotFoundException(
        `Documento DIAN ${dianDocumentId} no encontrado.`,
      );
    }

    if (dianDoc.status === DianDocumentStatus.ACCEPTED) {
      this.logger.warn(`Documento ${dianDocumentId} ya fue aceptado por DIAN.`);
      return;
    }

    // Validaciones pre-envío: evitan rechazos por datos incompletos o incoherentes
    this.validateBeforeSend(dianDoc);

    try {
      // Actualizar estado a SENT (procesando)
      try {
        await this.prisma.dianDocument.update({
          where: { id: dianDocumentId },
          data: { status: DianDocumentStatus.SENT },
        });
      } catch (e: any) {
        // Si el documento fue borrado en tests, omitir
        if (this.isTestEnv && e?.code === 'P2025') {
          this.logger.debug(
            `Documento DIAN ${dianDocumentId} ya no existe al actualizar SENT (tests). Omitiendo.`,
          );
          return;
        }
        throw e;
      }

      // 1. Generar XML
      this.logger.log(`Generando XML para documento ${dianDocumentId}`);
      const xml = await this.generateXML(dianDocumentId);

      // 2. Firmar documento
      this.logger.log(`Firmando documento ${dianDocumentId}`);
      const signedXml = await this.signDocument(xml, dianDocumentId);

      // 3. Enviar a DIAN
      this.logger.log(`Enviando documento ${dianDocumentId} a DIAN`);
      const dianResponse = await this.sendToDian(signedXml, dianDocumentId);

      // 4. Procesar respuesta
      await this.handleDianResponse(dianDocumentId, dianResponse);

      this.logger.log(`Documento ${dianDocumentId} procesado exitosamente`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      // En tests, si el documento ya no existe, no generar ruido ni reintentos
      if (
        this.isTestEnv &&
        (errorMessage.includes('no encontrado') || error?.code === 'P2025')
      ) {
        this.logger.debug(
          `Error DIAN ignorado en tests (documento no encontrado): ${dianDocumentId}`,
        );
        return;
      }

      this.logger.error(
        `Error procesando documento ${dianDocumentId}: ${errorMessage}`,
        errorStack,
      );

      // Actualizar estado a REJECTED (error en procesamiento)
      try {
        await this.prisma.dianDocument.update({
          where: { id: dianDocumentId },
          data: {
            status: DianDocumentStatus.REJECTED,
            lastError: errorMessage,
          },
        });
      } catch (e: any) {
        if (this.isTestEnv && e?.code === 'P2025') {
          this.logger.debug(
            `Documento DIAN ${dianDocumentId} ya no existe al actualizar REJECTED (tests).`,
          );
          return;
        }
        throw e;
      }

      // Registrar evento de error
      try {
        await this.prisma.dianEvent.create({
          data: {
            dianDocumentId,
            eventType: 'ERROR',
            payload: {
              error: errorMessage,
              stack: errorStack,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e: any) {
        // Si el documento ya fue borrado, la FK puede fallar en tests
        if (this.isTestEnv && (e?.code === 'P2003' || e?.code === 'P2025')) {
          this.logger.debug(
            `No se pudo crear DianEvent (tests) para documento ${dianDocumentId}: ${e?.code}`,
          );
        } else {
          throw e;
        }
      }

      throw error;
    }
  }

  /**
   * Escapa texto para uso seguro en XML (evita ruptura por <, >, &, ", ').
   * Ref: DIAN Anexo Técnico FE 1.9 / Resolución 000165 de 2023 (mod. 000008, 000119, 000189 de 2024).
   */
  private escapeXml(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Valida el documento y la factura antes de generar XML y enviar a DIAN.
   * Lanza BadRequestException si falta algo obligatorio o los datos son incoherentes.
   */
  private validateBeforeSend(
    dianDoc: Prisma.DianDocumentGetPayload<{
      include: {
        invoice: {
          include: {
            sale: {
              include: {
                items: { include: { product: true } };
                customer: true;
              };
            };
            customer: true;
          };
        };
      };
    }>,
  ): void {
    const invoice = dianDoc.invoice;
    if (!invoice) {
      throw new BadRequestException(
        'El documento DIAN no tiene factura asociada. No se puede enviar.',
      );
    }

    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new BadRequestException(
        'La factura está anulada. No se puede enviar a DIAN.',
      );
    }

    if (!invoice.number || String(invoice.number).trim() === '') {
      throw new BadRequestException(
        'La factura debe tener número. No se puede enviar a DIAN.',
      );
    }

    const subtotal = Number(invoice.subtotal);
    const taxTotal = Number(invoice.taxTotal);
    const discountTotal = Number(invoice.discountTotal ?? 0);
    const grandTotal = Number(invoice.grandTotal);
    if (
      !Number.isFinite(subtotal) ||
      !Number.isFinite(taxTotal) ||
      !Number.isFinite(grandTotal) ||
      subtotal < 0 ||
      taxTotal < 0 ||
      grandTotal < 0
    ) {
      throw new BadRequestException(
        'La factura debe tener subtotal, impuestos y total válidos (números >= 0).',
      );
    }

    const expectedGrandTotal = Math.round((subtotal + taxTotal - discountTotal) * 100) / 100;
    if (Math.abs(grandTotal - expectedGrandTotal) > 0.02) {
      throw new BadRequestException(
        `Total de la factura incoherente: subtotal + impuestos - descuento debe coincidir con el total (esperado ${expectedGrandTotal}, actual ${grandTotal}).`,
      );
    }

    const sale = invoice.sale;
    const customer = invoice.customer ?? sale?.customer;
    if (dianDoc.type === 'FE') {
      if (!sale?.items?.length) {
        throw new BadRequestException(
          'Factura electrónica de venta debe tener al menos un ítem en la venta.',
        );
      }
      if (!customer) {
        throw new BadRequestException(
          'Factura electrónica requiere cliente con documento (NIT/CC). Asocia la venta a un cliente con tipo y número de documento.',
        );
      }
      if (!customer.docType || !customer.docNumber || String(customer.docNumber).trim() === '') {
        throw new BadRequestException(
          'El cliente debe tener tipo de documento (docType) y número de documento (docNumber) para factura electrónica DIAN.',
        );
      }
    }
  }

  /**
   * Genera el XML según estándar UBL 2.1 y normativa DIAN.
   * Ref: Resolución 000165/2023, Anexo Técnico Factura Electrónica de Venta v1.9.
   * Documentación: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/
   */
  async generateXML(dianDocumentId: string): Promise<string> {
    const dianDoc = await this.prisma.dianDocument.findUnique({
      where: { id: dianDocumentId },
      include: {
        invoice: {
          include: {
            sale: {
              include: {
                items: {
                  include: { product: true },
                },
                customer: true,
              },
            },
            customer: true,
          },
        },
      },
    });

    if (!dianDoc || !dianDoc.invoice) {
      throw new NotFoundException(
        `Factura asociada al documento DIAN ${dianDocumentId} no encontrada.`,
      );
    }

    const invoice = dianDoc.invoice;
    const sale = invoice.sale;
    const customer = invoice.customer || sale?.customer;

    // Obtener configuración DIAN
    const config = this.getDianConfig();

    // UBL 2.1 Invoice: cada línea es un cac:InvoiceLine directo (sin wrapper). Ref: Anexo Técnico DIAN FE 1.9.
    const invoiceLinesXml =
      sale?.items
        .map(
          (item, index) => `
  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${item.qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="COP">${Number(item.unitPrice) * item.qty}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${this.escapeXml(item.product?.name || 'Producto')}</cbc:Description>
      <cac:StandardItemIdentification>
        <cbc:ID>${this.escapeXml(item.productId)}</cbc:ID>
      </cac:StandardItemIdentification>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="COP">${Number(item.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`,
        )
        .join('') || '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID>
  <cbc:ID>${this.escapeXml(invoice.number)}</cbc:ID>
  <cbc:IssueDate>${invoice.issuedAt.toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:IssueTime>${invoice.issuedAt.toISOString().split('T')[1].split('.')[0]}</cbc:IssueTime>
  <cbc:InvoiceTypeCode listID="01" listAgencyName="PE" listName="Tipo de Operación">01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode listID="ISO 4217 Alpha" listName="Currency" listAgencyName="United Nations Economic Commission for Europe">COP</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="4" schemeName="NIT">${this.escapeXml(config.issuerNit)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${this.escapeXml(config.issuerName)}</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  ${
    customer
      ? `
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${customer.docType === 'NIT' ? '4' : '1'}" schemeName="${customer.docType || 'CC'}">${this.escapeXml(customer.docNumber || '')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${this.escapeXml(customer.name || '')}</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>`
      : ''
  }
  ${invoiceLinesXml}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${Number(invoice.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${Number(invoice.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${Number(invoice.grandTotal)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="COP">${Number(invoice.grandTotal)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  
  <!-- Impuestos -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="COP">${Number(invoice.taxTotal)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="COP">${Number(invoice.subtotal)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="COP">${Number(invoice.taxTotal)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>19</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
</Invoice>`;

    // Guardar XML en el documento
    await this.prisma.dianDocument.update({
      where: { id: dianDocumentId },
      data: {
        xmlPath: `xml/${dianDocumentId}.xml`, // Ruta donde se guardaría el XML
      },
    });

    return xml;
  }

  /**
   * Carga clave privada y certificado desde archivo .p12/.pfx (PKCS#12).
   * Requiere DIAN_CERT_PATH y DIAN_CERT_PASSWORD configurados.
   */
  private async loadCertFromP12(): Promise<{
    privateKeyPem: string;
    certPem: string;
  }> {
    const pathToUse = resolve(this.certPath);
    const raw = await readFile(pathToUse);
    const binary = typeof raw === 'string' ? raw : raw.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(binary);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.certPassword);

    let keyBag = p12.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    })[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (!keyBag || keyBag.length === 0) {
      keyBag = p12.getBags({ bagType: forge.pki.oids.keyBag })[
        forge.pki.oids.keyBag
      ];
    }
    if (!keyBag || keyBag.length === 0) {
      throw new BadRequestException(
        'No se encontró clave privada en el certificado .p12.',
      );
    }
    const privateKey = keyBag[0].key;
    if (!privateKey) {
      throw new BadRequestException(
        'Clave privada no encontrada en el certificado .p12.',
      );
    }
    const privateKeyPem = forge.pki.privateKeyToPem(privateKey);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    if (!certBag || certBag.length === 0) {
      throw new BadRequestException(
        'No se encontró certificado en el archivo .p12.',
      );
    }
    const cert = certBag[0].cert;
    if (!cert) {
      throw new BadRequestException(
        'Certificado no encontrado en el archivo .p12.',
      );
    }
    const certPem = forge.pki.certificateToPem(cert);

    return { privateKeyPem, certPem };
  }

  /**
   * Firma digitalmente el XML con certificado .p12 (XMLDSig, RSA-SHA256).
   * Si DIAN_CERT_PATH/DIAN_CERT_PASSWORD no están configurados, retorna el XML sin firmar.
   * Ref: DIAN Anexo Técnico FE 1.9, XML Signature.
   */
  async signDocument(xml: string, dianDocumentId: string): Promise<string> {
    this.logger.log(`Firmando documento ${dianDocumentId}`);

    if (!this.certPath || !this.certPassword) {
      this.logger.warn(
        `⚠️ Firma digital omitida (certificado no configurado). Retornando XML sin firmar.`,
      );
      return xml;
    }

    const { privateKeyPem, certPem } = await this.loadCertFromP12();

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      publicCert: certPem,
      signatureAlgorithm: DIAN_SIGNATURE_ALG,
      canonicalizationAlgorithm: DIAN_C14N_ALG,
      implicitTransforms: [DIAN_TRANSFORM_ENVELOPED, DIAN_C14N_ALG],
    });

    // Referencia al documento completo (firma enveloped): se firma el elemento raíz Invoice
    sig.addReference({
      xpath: "//*[local-name(.)='Invoice']",
      transforms: [DIAN_TRANSFORM_ENVELOPED, DIAN_C14N_ALG],
      digestAlgorithm: DIAN_DIGEST_ALG,
      uri: '',
      inclusiveNamespacesPrefixList: [],
      isEmptyUri: true,
    });

    sig.computeSignature(xml, {
      location: {
        reference: "//*[local-name(.)='Invoice']",
        action: 'append',
      },
      existingPrefixes: {
        '': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      },
    });

    const signedXml = sig.getSignedXml();
    this.logger.log(`Documento ${dianDocumentId} firmado correctamente.`);
    return signedXml;
  }

  /**
   * Base URL del API DIAN. Si DIAN_API_BASE_URL está definida se usa.
   * Si DIAN_USE_DEFAULT_URL=true se usan las URLs por defecto (hab/prod). Si no, null = modo simulado.
   */
  private getDianBaseUrl(): string | null {
    const override = this.config.get<string>('DIAN_API_BASE_URL', '')?.trim();
    if (override) return override.replace(/\/$/, '');
    if (this.config.get<string>('DIAN_USE_DEFAULT_URL', '') === 'true') {
      return this.dianEnv === DianEnvironment.PRODUCCION
        ? DIAN_DEFAULT_BASE_URL_PROD
        : DIAN_DEFAULT_BASE_URL_HAB;
    }
    return null;
  }

  /**
   * URL completa para envío.
   */
  private getDianSendUrl(): string {
    const base = this.getDianBaseUrl();
    if (!base) {
      throw new BadRequestException(
        'DIAN_API_BASE_URL no configurada. Configure la URL base del API DIAN para envío real.',
      );
    }
    const path =
      this.config.get<string>('DIAN_SEND_PATH', '')?.trim() || DIAN_SEND_PATH;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /**
   * Construye el sobre SOAP para ReceiveInvoice (DIAN WCF).
   * Ref: namespace http://wcf.dian.colombia, operación ReceiveInvoice con fileName y contentFile (base64).
   */
  private buildSoapEnvelopeReceiveInvoice(
    signedXml: string,
    fileName: string,
  ): string {
    const contentFile = Buffer.from(signedXml, 'utf-8').toString('base64');
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wcf="http://wcf.dian.colombia">
  <soap:Header>
    <wcf:SoftwareID>${this.escapeXml(this.softwareId)}</wcf:SoftwareID>
    <wcf:SoftwarePIN>${this.escapeXml(this.softwarePin)}</wcf:SoftwarePIN>
  </soap:Header>
  <soap:Body>
    <wcf:ReceiveInvoice>
      <wcf:fileName>${this.escapeXml(fileName)}</wcf:fileName>
      <wcf:contentFile>${contentFile}</wcf:contentFile>
    </wcf:ReceiveInvoice>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * POST al API DIAN con timeout y reintentos. Devuelve el cuerpo de la respuesta.
   */
  private async sendToDianHttp(
    body: string,
    dianDocumentId: string,
    useSoap: boolean,
  ): Promise<string> {
    const url = this.getDianSendUrl();
    const controller = new AbortController();
    const timeoutMs = this.config.get<number>(
      'DIAN_HTTP_TIMEOUT_MS',
      DIAN_HTTP_TIMEOUT_MS,
    );
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let lastError: Error | null = null;
    const maxRetries = this.config.get<number>(
      'DIAN_HTTP_MAX_RETRIES',
      DIAN_HTTP_MAX_RETRIES,
    );
    const retryDelayMs = this.config.get<number>(
      'DIAN_HTTP_RETRY_DELAY_MS',
      DIAN_HTTP_RETRY_DELAY_MS,
    );

    const headers: Record<string, string> = useSoap
      ? {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          SOAPAction: `"${DIAN_SOAP_ACTION_RECEIVE}"`,
          Accept: 'text/xml, application/xml, */*',
        }
      : {
          'Content-Type': 'application/xml',
          Accept: 'application/xml, application/json, text/xml, */*',
        };
    if (this.softwareId && !useSoap) {
      headers.SoftwareID = this.softwareId;
      headers.SoftwarePIN = this.softwarePin;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(
          `Envío DIAN intento ${attempt}/${maxRetries} a ${url}`,
        );
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const responseBody = await res.text();
        if (!res.ok) {
          const excerpt = responseBody.trim().slice(0, 2000);
          const headersObj = Object.fromEntries(res.headers.entries());
          this.logger.warn(
            `DIAN respuesta ${res.status} cuerpo=${excerpt ? excerpt.length + ' chars' : 'vacío'} body=${excerpt || '(vacío)'}`,
          );
          this.logger.warn(
            `DIAN respuesta ${res.status} headers=${JSON.stringify(headersObj)}`,
          );
          throw new Error(
            `DIAN respondió ${res.status} ${res.statusText}: ${excerpt || '(cuerpo vacío)'}`,
          );
        }
        return responseBody;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (this.isTestEnv) throw lastError;
        this.logger.warn(
          `Intento ${attempt}/${maxRetries} fallido: ${lastError.message}`,
        );
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
        }
      }
    }
    clearTimeout(timeoutId);
    throw lastError ?? new Error('Envío DIAN falló sin detalle');
  }

  /**
   * Parsea la respuesta del API DIAN (XML o JSON) a DianResponse.
   */
  private parseDianResponse(
    responseBody: string,
    _dianDocumentId: string,
  ): DianResponse {
    const timestamp = new Date().toISOString();
    const body = responseBody.trim();

    if (!body) {
      return {
        success: false,
        message: 'Respuesta vacía del API DIAN',
        timestamp,
      };
    }

    if (body.startsWith('{')) {
      try {
        const json = JSON.parse(body) as Record<string, unknown>;
        const isValid =
          json.IsValid === true ||
          json.isValid === true ||
          json.Success === true ||
          json.success === true;
        const cufe =
          (json.CUFE as string) ??
          (json.Cufe as string) ??
          (json.cufe as string);
        const msg =
          (json.Description as string) ??
          (json.Message as string) ??
          (json.message as string) ??
          (json.ResponseMessage as string);
        return {
          success: !!isValid,
          cufe: typeof cufe === 'string' ? cufe : undefined,
          message: typeof msg === 'string' ? msg : undefined,
          errors: Array.isArray(json.errors) ? (json.errors as string[]) : undefined,
          timestamp,
        };
      } catch {
        // seguir con XML
      }
    }

    const upper = body.toUpperCase();
    const isValid =
      upper.includes('<ISVALID>TRUE</ISVALID>') ||
      upper.includes('<ISVALID>1</ISVALID>') ||
      /ResponseCode[\s"=>]*0\s*</i.test(body);
    const cufeMatch = body.match(
      /<CUFE[^>]*>([^<]+)<\/CUFE>|<Cufe[^>]*>([^<]+)<\/Cufe>/i,
    );
    const cufe = cufeMatch ? (cufeMatch[1] || cufeMatch[2] || '').trim() : undefined;
    const descMatch = body.match(
      /<Description[^>]*>([^<]*)<\/Description>|<ResponseMessage[^>]*>([^<]*)<\/ResponseMessage>|<Message[^>]*>([^<]*)<\/Message>/i,
    );
    const message = descMatch
      ? (descMatch[1] || descMatch[2] || descMatch[3] || '').trim()
      : undefined;

    return {
      success: !!isValid,
      cufe,
      message:
        message ||
        (isValid ? 'Documento aceptado' : 'Documento rechazado por DIAN'),
      timestamp,
    };
  }

  /**
   * Envía el documento firmado a DIAN.
   * Si DIAN_API_BASE_URL está configurada (o se usan URLs por defecto), hace POST con sobre SOAP ReceiveInvoice.
   * Si no hay URL configurada, simula respuesta (desarrollo).
   */
  async sendToDian(
    signedXml: string,
    dianDocumentId: string,
  ): Promise<DianResponse> {
    this.logger.log(
      `Enviando documento ${dianDocumentId} a DIAN (ambiente: ${this.dianEnv})`,
    );

    if (!this.softwareId || !this.softwarePin) {
      throw new BadRequestException(
        'DIAN_SOFTWARE_ID y DIAN_SOFTWARE_PIN deben estar configurados para enviar documentos a DIAN.',
      );
    }

    const baseUrl = this.getDianBaseUrl();
    let response: DianResponse;

    if (baseUrl) {
      try {
        const useSoap = this.config.get<string>('DIAN_USE_SOAP', 'true') !== 'false';
        const fileName = `factura-${dianDocumentId}.xml`;
        const body = useSoap
          ? this.buildSoapEnvelopeReceiveInvoice(signedXml, fileName)
          : signedXml;
        const responseBody = await this.sendToDianHttp(
          body,
          dianDocumentId,
          useSoap,
        );
        response = this.parseDianResponse(responseBody, dianDocumentId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Envío DIAN fallido para ${dianDocumentId}: ${errorMessage}`,
        );
        response = {
          success: false,
          message: errorMessage,
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      this.logger.warn(
        `⚠️ DIAN_API_BASE_URL no configurada. Simulando respuesta exitosa.`,
      );
      response = {
        success: true,
        cufe: `CUFE-${dianDocumentId.substring(0, 8).toUpperCase()}-${Date.now()}`,
        qrCode: `QR-CODE-MOCK-${dianDocumentId}`,
        message: 'Documento aceptado (simulado)',
        timestamp: new Date().toISOString(),
      };
    }

    await this.prisma.dianEvent.create({
      data: {
        dianDocumentId,
        eventType: 'SENT',
        payload: {
          response: {
            success: response.success,
            cufe: response.cufe ?? null,
            qrCode: response.qrCode ?? null,
            message: response.message ?? null,
            timestamp: response.timestamp,
          },
          environment: this.dianEnv,
        } as Prisma.InputJsonValue,
      },
    });

    return response;
  }

  /**
   * Procesa la respuesta de DIAN y actualiza el estado del documento
   */
  async handleDianResponse(
    dianDocumentId: string,
    response: DianResponse,
  ): Promise<void> {
    if (response.success) {
      // Documento aceptado
      await this.prisma.dianDocument.update({
        where: { id: dianDocumentId },
        data: {
          status: DianDocumentStatus.ACCEPTED,
          cufe: response.cufe,
          sentAt: new Date(),
          lastError: null,
        },
      });

      // Generar PDF de factura
      await this.generatePDF(dianDocumentId);

      // Registrar evento de aceptación
      await this.prisma.dianEvent.create({
        data: {
          dianDocumentId,
          eventType: 'ACCEPTED',
          payload: {
            cufe: response.cufe,
            qrCode: response.qrCode,
            timestamp: response.timestamp,
          },
        },
      });

      this.logger.log(
        `Documento ${dianDocumentId} aceptado por DIAN. CUFE: ${response.cufe}`,
      );
    } else {
      // Documento rechazado
      const docBefore = await this.prisma.dianDocument.findUnique({
        where: { id: dianDocumentId },
        select: { status: true },
      });
      await this.prisma.dianDocument.update({
        where: { id: dianDocumentId },
        data: {
          status: DianDocumentStatus.REJECTED,
          lastError: response.message || 'Documento rechazado por DIAN',
          sentAt: new Date(),
        },
      });
      await this.audit.log(
        'dianDocument',
        dianDocumentId,
        'status_update',
        null,
        {
          oldStatus: docBefore?.status ?? 'DRAFT',
          newStatus: DianDocumentStatus.REJECTED,
          error: response.message,
        },
      );

      // Registrar evento de rechazo
      await this.prisma.dianEvent.create({
        data: {
          dianDocumentId,
          eventType: 'REJECTED',
          payload: {
            error: response.message,
            errors: response.errors || [],
            timestamp: response.timestamp,
          },
        },
      });

      this.logger.error(
        `Documento ${dianDocumentId} rechazado por DIAN: ${response.message}`,
      );
    }
  }

  /**
   * Genera el PDF de la factura
   * Por ahora solo registra la acción - debe implementarse con librería de PDF
   */
  async generatePDF(dianDocumentId: string): Promise<string> {
    this.logger.log(`Generando PDF para documento ${dianDocumentId}`);

    // TODO: Implementar generación de PDF
    // Requiere:
    // - Librería de PDF (pdfkit, puppeteer, etc.)
    // - Plantilla de factura
    // - Incluir QR code y CUFE
    // - Guardar PDF en storage

    const pdfPath = `pdf/${dianDocumentId}.pdf`;

    await this.prisma.dianDocument.update({
      where: { id: dianDocumentId },
      data: { pdfPath },
    });

    this.logger.warn(
      `⚠️ Generación de PDF no implementada. Ruta simulada: ${pdfPath}`,
    );

    return pdfPath;
  }

  /**
   * Obtiene la configuración DIAN activa
   */
  getDianConfig() {
    // Por ahora usa variables de entorno
    // En el futuro puede leer de la tabla DianConfig
    const issuerNit = this.config.get<string>('DIAN_ISSUER_NIT', '')?.trim();
    const issuerName = this.config.get<string>('DIAN_ISSUER_NAME', '')?.trim();
    return {
      env: this.dianEnv,
      softwareId: this.softwareId,
      softwarePin: this.softwarePin,
      /** NIT del emisor (empresa). Si no se define, se usa softwareId en el XML (puede causar 400). */
      issuerNit: issuerNit || this.softwareId,
      /** Razón social del emisor. Si no se define, se usa un nombre por defecto. */
      issuerName: issuerName || (this.softwareId ? 'EMPRESA COMERCIAL ELECTRICA' : 'Emisor'),
      resolutionNumber: this.config.get<string>('DIAN_RESOLUTION_NUMBER'),
      prefix: this.config.get<string>('DIAN_PREFIX', 'FAC'),
      rangeFrom: this.config.get<number>('DIAN_RANGE_FROM', 1),
      rangeTo: this.config.get<number>('DIAN_RANGE_TO', 999999),
    };
  }

  /**
   * Consulta el estado de un documento DIAN para un tenant específico.
   *
   * Garantiza aislamiento multi-tenant usando el tenantId de la factura
   * asociada al documento DIAN.
   */
  async queryDocumentStatus(
    dianDocumentId: string,
    tenantId?: string | null,
  ): Promise<DianDocumentStatus> {
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para consultar estado de documentos DIAN.',
      );
    }

    const doc = await this.prisma.dianDocument.findFirst({
      where: {
        id: dianDocumentId,
        invoice: {
          tenantId,
        },
      },
      select: {
        status: true,
      },
    });

    if (!doc) {
      // No revelamos si el ID existe para otro tenant: mantenemos aislamiento
      throw new NotFoundException(
        `Documento DIAN ${dianDocumentId} no encontrado.`,
      );
    }

    // TODO: Implementar consulta real a DIAN
    // Por ahora retorna el estado almacenado
    return doc.status;
  }

  /**
   * Obtiene el detalle de estado de un documento DIAN (status + metadatos)
   * asegurando aislamiento multi-tenant por tenantId de la factura.
   */
  async getDocumentStatusForTenant(
    dianDocumentId: string,
    tenantId?: string | null,
  ): Promise<{
    status: DianDocumentStatus;
    cufe: string | null;
    sentAt: Date | null;
    lastError: string | null;
  }> {
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant requerido para consultar estado de documentos DIAN.',
      );
    }

    const doc = await this.prisma.dianDocument.findFirst({
      where: {
        id: dianDocumentId,
        invoice: {
          tenantId,
        },
      },
      select: {
        status: true,
        cufe: true,
        sentAt: true,
        lastError: true,
      },
    });

    if (!doc) {
      throw new NotFoundException(
        `Documento DIAN ${dianDocumentId} no encontrado.`,
      );
    }

    return {
      status: doc.status,
      cufe: doc.cufe ?? null,
      sentAt: doc.sentAt ?? null,
      lastError: doc.lastError ?? null,
    };
  }
}

/**
 * Interfaz para respuestas de DIAN
 */
export interface DianResponse {
  success: boolean;
  cufe?: string;
  qrCode?: string;
  message?: string;
  errors?: string[];
  timestamp: string;
}
