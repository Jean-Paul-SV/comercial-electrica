import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DianDocumentStatus, DianEnvironment, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Cargar configuración desde variables de entorno
    this.dianEnv =
      (this.config.get<string>(
        'DIAN_ENV',
        'HABILITACION',
      ) as DianEnvironment) || DianEnvironment.HABILITACION;
    this.softwareId = this.config.get<string>('DIAN_SOFTWARE_ID', '') || '';
    this.softwarePin = this.config.get<string>('DIAN_SOFTWARE_PIN', '') || '';

    if (!this.softwareId || !this.softwarePin) {
      this.logger.warn(
        '⚠️ DIAN_SOFTWARE_ID o DIAN_SOFTWARE_PIN no configurados. El procesamiento DIAN no funcionará.',
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

    try {
      // Actualizar estado a SENT (procesando)
      await this.prisma.dianDocument.update({
        where: { id: dianDocumentId },
        data: { status: DianDocumentStatus.SENT },
      });

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
      this.logger.error(
        `Error procesando documento ${dianDocumentId}: ${errorMessage}`,
        errorStack,
      );

      // Actualizar estado a REJECTED (error en procesamiento)
      await this.prisma.dianDocument.update({
        where: { id: dianDocumentId },
        data: {
          status: DianDocumentStatus.REJECTED,
          lastError: errorMessage,
        },
      });

      // Registrar evento de error
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

      throw error;
    }
  }

  /**
   * Genera el XML según el estándar DIAN (Resolución 00000010 de 2024)
   * Por ahora retorna un XML básico - debe implementarse según especificación completa
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

    // Generar XML básico según estándar DIAN
    // NOTA: Este es un XML simplificado. En producción debe seguir la especificación completa
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID>
  <cbc:ID>${invoice.number}</cbc:ID>
  <cbc:IssueDate>${invoice.issuedAt.toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:IssueTime>${invoice.issuedAt.toISOString().split('T')[1].split('.')[0]}</cbc:IssueTime>
  <cbc:InvoiceTypeCode listID="01" listAgencyName="PE" listName="Tipo de Operación">01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode listID="ISO 4217 Alpha" listName="Currency" listAgencyName="United Nations Economic Commission for Europe">COP</cbc:DocumentCurrencyCode>
  
  <!-- Emisor -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="4" schemeName="NIT">${config.softwareId}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>EMPRESA COMERCIAL ELECTRICA</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  
  <!-- Cliente -->
  ${
    customer
      ? `
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${customer.docType === 'NIT' ? '4' : '1'}" schemeName="${customer.docType}">${customer.docNumber}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${customer.name}</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  `
      : ''
  }
  
  <!-- Items -->
  <cac:InvoiceLine>
    ${
      sale?.items
        .map(
          (item, index) => `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="C62">${item.qty}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="COP">${Number(item.unitPrice) * item.qty}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${item.product?.name || 'Producto'}</cbc:Description>
        <cac:StandardItemIdentification>
          <cbc:ID>${item.productId}</cbc:ID>
        </cac:StandardItemIdentification>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="COP">${Number(item.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>
    `,
        )
        .join('') || ''
    }
  </cac:InvoiceLine>
  
  <!-- Totales -->
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
   * Firma digitalmente el XML usando certificado digital
   * Por ahora retorna el XML sin firmar - debe implementarse con librería de firma digital
   */
  async signDocument(xml: string, dianDocumentId: string): Promise<string> {
    this.logger.log(`Firmando documento ${dianDocumentId}`);

    // TODO: Implementar firma digital real
    await Promise.resolve(); // Placeholder para mantener async
    // Requiere:
    // - Certificado digital (.p12 o .pfx)
    // - Librería de firma XML (xml-crypto, xmldsigjs, etc.)
    // - Validación de certificado

    // Por ahora retornamos el XML sin firmar
    // En producción esto debe firmarse correctamente
    this.logger.warn(
      `⚠️ Firma digital no implementada. Retornando XML sin firmar.`,
    );

    return xml;
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
      await this.prisma.dianDocument.update({
        where: { id: dianDocumentId },
        data: {
          status: DianDocumentStatus.REJECTED,
          lastError: response.message || 'Documento rechazado por DIAN',
          sentAt: new Date(),
        },
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
