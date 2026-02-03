import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DianDocumentStatus, DianEnvironment, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../common/services/audit.service';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

/** Algoritmos DIAN: RSA-SHA256, SHA256, C14N exclusivo. Ref: Anexo Técnico FE 1.9 */
const DIAN_SIGNATURE_ALG = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const DIAN_DIGEST_ALG = 'http://www.w3.org/2001/04/xmlenc#sha256';
const DIAN_C14N_ALG = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const DIAN_TRANSFORM_ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

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
      throw new NotFoundException(`Documento DIAN ${dianDocumentId} no encontrado.`);
    }

    if (dianDoc.status === DianDocumentStatus.ACCEPTED) {
      this.logger.warn(`Documento ${dianDocumentId} ya fue aceptado por DIAN.`);
      return;
    }

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
        (errorMessage.includes('no encontrado') || (error as any)?.code === 'P2025')
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
        <cbc:ID schemeID="4" schemeName="NIT">${this.escapeXml(config.softwareId)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${this.escapeXml(config.softwareId ? 'EMPRESA COMERCIAL ELECTRICA' : 'Emisor')}</cbc:Name>
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
      implicitTransforms: [
        DIAN_TRANSFORM_ENVELOPED,
        DIAN_C14N_ALG,
      ],
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
   * Envía el documento firmado a DIAN
   * Por ahora simula el envío - debe implementarse con API real de DIAN
   */
  async sendToDian(
    signedXml: string,
    dianDocumentId: string,
  ): Promise<DianResponse> {
    this.logger.log(
      `Enviando documento ${dianDocumentId} a DIAN (ambiente: ${this.dianEnv})`,
    );

    // Validar configuración
    if (!this.softwareId || !this.softwarePin) {
      throw new BadRequestException(
        'DIAN_SOFTWARE_ID y DIAN_SOFTWARE_PIN deben estar configurados para enviar documentos a DIAN.',
      );
    }

    // TODO: Implementar envío real a DIAN
    // Requiere:
    // - Autenticación con softwareId y softwarePin
    // - Endpoint de DIAN según ambiente (habilitación o producción)
    // - Manejo de errores de red
    // - Reintentos automáticos

    // Por ahora simulamos una respuesta exitosa
    this.logger.warn(
      `⚠️ Envío a DIAN no implementado. Simulando respuesta exitosa.`,
    );

    // Simular respuesta de DIAN
    const mockResponse: DianResponse = {
      success: true,
      cufe: `CUFE-${dianDocumentId.substring(0, 8).toUpperCase()}-${Date.now()}`,
      qrCode: `QR-CODE-MOCK-${dianDocumentId}`,
      message: 'Documento aceptado (simulado)',
      timestamp: new Date().toISOString(),
    };

    // Registrar evento de envío
    await this.prisma.dianEvent.create({
      data: {
        dianDocumentId,
        eventType: 'SENT',
        payload: {
          response: {
            success: mockResponse.success,
            cufe: mockResponse.cufe || null,
            qrCode: mockResponse.qrCode || null,
            message: mockResponse.message || null,
            timestamp: mockResponse.timestamp,
          },
          environment: this.dianEnv,
        } as Prisma.InputJsonValue,
      },
    });

    return mockResponse;
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
      await this.audit.log('dianDocument', dianDocumentId, 'status_update', null, {
        oldStatus: docBefore?.status ?? 'DRAFT',
        newStatus: DianDocumentStatus.REJECTED,
        error: response.message,
      });

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
    return {
      env: this.dianEnv,
      softwareId: this.softwareId,
      softwarePin: this.softwarePin,
      resolutionNumber: this.config.get<string>('DIAN_RESOLUTION_NUMBER'),
      prefix: this.config.get<string>('DIAN_PREFIX', 'FAC'),
      rangeFrom: this.config.get<number>('DIAN_RANGE_FROM', 1),
      rangeTo: this.config.get<number>('DIAN_RANGE_TO', 999999),
    };
  }

  /**
   * Consulta el estado de un documento en DIAN
   */
  async queryDocumentStatus(
    dianDocumentId: string,
  ): Promise<DianDocumentStatus> {
    const doc = await this.prisma.dianDocument.findUnique({
      where: { id: dianDocumentId },
    });

    if (!doc) {
      throw new NotFoundException(
        `Documento DIAN ${dianDocumentId} no encontrado.`,
      );
    }

    // TODO: Implementar consulta real a DIAN
    // Por ahora retorna el estado almacenado
    return doc.status;
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
