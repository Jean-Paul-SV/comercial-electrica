import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DianService } from './dian.service';
import { AlertService } from '../common/services/alert.service';
import { ConfigService } from '@nestjs/config';
import { DianDocumentStatus } from '@prisma/client';

/**
 * C3.2: Servicio que reconcilia documentos DIAN con el estado real en DIAN.
 * Consulta GetStatus para documentos en estado SENT y actualiza BD si hay inconsistencias.
 */
@Injectable()
export class DianReconciliationService {
  private readonly logger = new Logger(DianReconciliationService.name);
  private readonly minHoursBeforeReconciliation: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dianService: DianService,
    private readonly alertService: AlertService,
    private readonly config: ConfigService,
  ) {
    // Horas mínimas después del envío antes de reconciliar (default: 1 hora)
    // Esto da tiempo a DIAN para procesar el documento
    this.minHoursBeforeReconciliation = parseInt(
      this.config.get<string>('DIAN_RECONCILIATION_MIN_HOURS') || '1',
      10,
    );
  }

  /**
   * Reconciliación diaria: consulta estado de documentos SENT en DIAN.
   * 
   * Busca documentos en estado SENT que fueron enviados hace más de X horas
   * y consulta su estado real en DIAN usando GetStatus.
   */
  async reconcileSentDocuments(): Promise<{
    checked: number;
    synced: number;
    accepted: number;
    rejected: number;
    errors: number;
  }> {
    const cutoffTime = new Date();
    cutoffTime.setHours(
      cutoffTime.getHours() - this.minHoursBeforeReconciliation,
    );

    // Buscar documentos en estado SENT con CUFE que fueron enviados hace más de X horas
    const documents = await this.prisma.dianDocument.findMany({
      where: {
        status: DianDocumentStatus.SENT,
        cufe: { not: null },
        sentAt: { lte: cutoffTime },
      },
      include: {
        invoice: {
          select: {
            tenantId: true,
            number: true,
          },
        },
      },
      take: 100, // Limitar a 100 por ejecución para no sobrecargar DIAN
    });

    let synced = 0;
    let accepted = 0;
    let rejected = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        if (!doc.invoice?.tenantId) {
          this.logger.warn(
            `Documento ${doc.id} sin tenantId asociado, omitiendo`,
          );
          continue;
        }

        const tenantId = doc.invoice.tenantId;

        // Obtener configuración DIAN del tenant para usar sus credenciales
        const config = await this.prisma.dianConfig.findUnique({
          where: { tenantId },
          select: {
            softwareId: true,
            softwarePin: true,
            env: true,
          },
        });

        if (!config?.softwareId || !config?.softwarePin) {
          this.logger.warn(
            `Tenant ${tenantId} no tiene softwareId/softwarePin configurado, omitiendo reconciliación`,
          );
          continue;
        }

        // Usar el método existente de DianService que ya maneja GetStatus
        // Nota: syncDocumentStatusFromDian usa credenciales globales, pero funciona
        // porque GetStatus puede usar CUFE sin necesidad de credenciales específicas del tenant
        // Sin embargo, para ser más preciso, podríamos modificar syncDocumentStatusFromDian
        // para aceptar credenciales del tenant. Por ahora usamos el método existente.
        await this.dianService.syncDocumentStatusFromDian(doc.id, tenantId);

        // Verificar si el estado cambió
        const updated = await this.prisma.dianDocument.findUnique({
          where: { id: doc.id },
          select: { status: true },
        });

        if (updated && updated.status !== DianDocumentStatus.SENT) {
          synced++;
          if (updated.status === DianDocumentStatus.ACCEPTED) {
            accepted++;
            this.logger.log(
              `Documento ${doc.id} (factura ${doc.invoice.number}) reconciliado: ACCEPTED`,
            );
          } else if (updated.status === DianDocumentStatus.REJECTED) {
            rejected++;
            this.logger.warn(
              `Documento ${doc.id} (factura ${doc.invoice.number}) reconciliado: REJECTED`,
            );

            // Enviar alerta crítica si documento fue rechazado
            const alertsEnabled =
              this.config.get<string>('ALERTS_ENABLED') === 'true';
            if (alertsEnabled) {
              await this.alertService.sendAlert({
                title: `🚨 Documento DIAN rechazado - Tenant ${tenantId}`,
                message: `El documento DIAN ${doc.id} (factura ${doc.invoice.number}) fue rechazado por DIAN. Revisar configuración y reenviar si es necesario.`,
                severity: 'critical',
                metadata: {
                  dianDocumentId: doc.id,
                  invoiceNumber: doc.invoice.number,
                  tenantId,
                  cufe: doc.cufe,
                  timestamp: new Date().toISOString(),
                },
              });
            }
          }
        }
      } catch (err) {
        errors++;
        this.logger.error(
          `Error reconciliando documento ${doc.id}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    return {
      checked: documents.length,
      synced,
      accepted,
      rejected,
      errors,
    };
  }

  /**
   * Reconciliación manual de un documento específico.
   * Útil para debugging o cuando se necesita forzar una consulta.
   */
  async reconcileDocument(
    dianDocumentId: string,
    tenantId: string,
  ): Promise<{ success: boolean; newStatus?: DianDocumentStatus }> {
    try {
      const doc = await this.prisma.dianDocument.findFirst({
        where: {
          id: dianDocumentId,
          invoice: { tenantId },
        },
        select: { id: true, status: true, cufe: true },
      });

      if (!doc) {
        throw new Error('Documento no encontrado');
      }

      if (!doc.cufe) {
        throw new Error('Documento no tiene CUFE, no se puede reconciliar');
      }

      await this.dianService.syncDocumentStatusFromDian(
        dianDocumentId,
        tenantId,
      );

      const updated = await this.prisma.dianDocument.findUnique({
        where: { id: dianDocumentId },
        select: { status: true },
      });

      return {
        success: true,
        newStatus: updated?.status,
      };
    } catch (err) {
      this.logger.error(
        `Error en reconciliación manual de documento ${dianDocumentId}: ${(err as Error).message}`,
      );
      return { success: false };
    }
  }
}
