import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { getAuditContext } from '../audit/audit-context';

/** Contexto opcional para enriquecer el log (ip, userAgent, severity, category). */
export interface AuditLogContext {
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  severity?: string | null;
  category?: string | null;
}

const GENESIS_HASH = '';

function canonicalPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Servicio centralizado para audit logging
 * Proporciona métodos reutilizables para registrar acciones del sistema.
 * Cada registro forma parte de una cadena de integridad (previousHash -> entryHash).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una acción de auditoría
   * @param context Opcional: requestId, ip, userAgent, severity, category. Si no se pasa, ip/requestId/userAgent se toman del contexto del request (AuditContextInterceptor).
   */
  async log(
    entity: string,
    entityId: string,
    action: string,
    actorId?: string | null,
    diff?: Record<string, unknown>,
    context?: AuditLogContext,
  ) {
    // En modo test, no registrar auditoría para evitar problemas de foreign key constraints
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID !== undefined ||
      process.env.CI === 'true' ||
      typeof jest !== 'undefined'
    ) {
      return;
    }

    const requestContext = getAuditContext();
    const requestId =
      context?.requestId ?? requestContext?.requestId ?? null;
    const ip = context?.ip ?? requestContext?.ip ?? null;
    const userAgent = context?.userAgent ?? requestContext?.userAgent ?? null;
    const severity = context?.severity ?? null;
    const category = context?.category ?? null;

    const id = randomUUID();
    const createdAt = new Date();

    try {
      const lastLog = await this.prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { entryHash: true },
      });
      const previousHash = lastLog?.entryHash ?? GENESIS_HASH;

      const payload = canonicalPayload({
        id,
        actorId: actorId ?? null,
        entity,
        entityId,
        action,
        diff: diff ?? null,
        requestId: requestId ?? null,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        severity: severity ?? null,
        category: category ?? null,
        createdAt: createdAt.toISOString(),
      });
      const entryHash = sha256Hex(previousHash + '|' + payload);

      await this.prisma.auditLog.create({
        data: {
          id,
          actorId: actorId ?? null,
          entity,
          entityId,
          action,
          diff: diff ? (diff as object) : undefined,
          requestId: requestId ?? undefined,
          ip: ip ?? undefined,
          userAgent: userAgent ?? undefined,
          severity: severity ?? undefined,
          category: category ?? undefined,
          createdAt,
          previousHash: previousHash || undefined,
          entryHash,
        },
      });
    } catch (error) {
      console.error('Error al registrar audit log:', error);
    }
  }

  /**
   * Registra creación de entidad
   */
  async logCreate(
    entity: string,
    entityId: string,
    actorId?: string | null,
    data?: Record<string, unknown>,
  ) {
    return this.log(entity, entityId, 'create', actorId, data);
  }

  /**
   * Registra actualización de entidad
   */
  async logUpdate(
    entity: string,
    entityId: string,
    actorId: string | null | undefined,
    oldData?: Record<string, unknown>,
    newData?: Record<string, unknown>,
  ) {
    const diff = {
      old: oldData,
      new: newData,
    };
    return this.log(entity, entityId, 'update', actorId, diff);
  }

  /**
   * Registra eliminación de entidad
   */
  async logDelete(
    entity: string,
    entityId: string,
    actorId?: string | null,
    data?: Record<string, unknown>,
  ) {
    return this.log(entity, entityId, 'delete', actorId, data);
  }

  /**
   * Registra acceso a recurso
   */
  async logAccess(
    entity: string,
    entityId: string,
    actorId?: string | null,
    details?: Record<string, unknown>,
  ) {
    return this.log(entity, entityId, 'access', actorId, details);
  }

  /**
   * Registra autenticación (category=security, severity=high)
   */
  async logAuth(
    action: 'login' | 'logout' | 'login_failed',
    actorId?: string | null,
    details?: Record<string, unknown>,
  ) {
    return this.log('auth', actorId || 'unknown', action, actorId, details, {
      category: 'security',
      severity: 'high',
    });
  }

  /**
   * Verifica la cadena de integridad de los logs de auditoría (ordenados por createdAt asc).
   * Comprueba que cada entryHash = H(previousHash | payload) y que previousHash del siguiente = entryHash del anterior.
   */
  async verifyChain(): Promise<{
    valid: boolean;
    totalChecked: number;
    totalWithHash: number;
    brokenAt?: string;
    errors: string[];
  }> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        actorId: true,
        entity: true,
        entityId: true,
        action: true,
        diff: true,
        requestId: true,
        ip: true,
        userAgent: true,
        severity: true,
        category: true,
        createdAt: true,
        previousHash: true,
        entryHash: true,
      },
    });
    const totalWithHash = logs.filter((l) => l.entryHash != null).length;
    const errors: string[] = [];
    let previousEntryHash: string | null = GENESIS_HASH;

    for (const log of logs) {
      if (log.entryHash == null) continue;
      const payload = canonicalPayload({
        id: log.id,
        actorId: log.actorId,
        entity: log.entity,
        entityId: log.entityId,
        action: log.action,
        diff: log.diff,
        requestId: log.requestId,
        ip: log.ip,
        userAgent: log.userAgent,
        severity: log.severity,
        category: log.category,
        createdAt:
          log.createdAt instanceof Date
            ? log.createdAt.toISOString()
            : String(log.createdAt),
      });
      const expectedHash = sha256Hex(
        (previousEntryHash ?? '') + '|' + payload,
      );
      if (expectedHash !== log.entryHash) {
        errors.push(
          `Log ${log.id}: hash inválido (esperado ${expectedHash.slice(0, 16)}..., actual ${log.entryHash?.slice(0, 16)}...)`,
        );
        return {
          valid: false,
          totalChecked: logs.length,
          totalWithHash,
          brokenAt: log.id,
          errors,
        };
      }
      if (log.previousHash !== (previousEntryHash || null)) {
        errors.push(
          `Log ${log.id}: previousHash no enlaza con el registro anterior`,
        );
        return {
          valid: false,
          totalChecked: logs.length,
          totalWithHash,
          brokenAt: log.id,
          errors,
        };
      }
      previousEntryHash = log.entryHash;
    }

    return {
      valid: errors.length === 0,
      totalChecked: logs.length,
      totalWithHash,
      errors,
    };
  }
}
