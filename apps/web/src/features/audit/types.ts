/**
 * Tipos para el módulo de auditoría.
 */

export type AuditLogActor = {
  id: string;
  email: string | null;
  role: string | null;
};

export type AuditLog = {
  id: string;
  actorId: string | null;
  entity: string;
  entityId: string;
  action: string;
  summary: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
  actor: AuditLogActor | null;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type ListAuditLogsParams = {
  page?: number;
  limit?: number;
  entity?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
};

export type VerifyChainResponse = {
  valid: boolean;
  totalChecked: number;
  totalWithHash: number;
  brokenAt?: string;
  errors: string[];
};
