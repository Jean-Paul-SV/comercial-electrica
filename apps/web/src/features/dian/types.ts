export type DianDocumentStatus =
  | 'DRAFT'
  | 'SIGNED'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED';

export type DianDocumentStatusResponse = {
  id: string;
  invoiceId: string;
  type: string;
  status: DianDocumentStatus;
  cufe?: string | null;
  lastError?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DianEnvironment = 'HABILITACION' | 'PRODUCCION';

/** Configuración DIAN pública (sin PIN ni certificado). */
export type DianConfigPublic = {
  id: string;
  tenantId: string;
  env: DianEnvironment;
  issuerNit?: string;
  issuerName?: string;
  softwareId?: string;
  resolutionNumber?: string;
  prefix?: string;
  rangeFrom?: number;
  rangeTo?: number;
  certValidUntil?: string;
  hasCert: boolean;
  hasSoftwarePin: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Estado de configuración DIAN por tenant. */
export type DianConfigStatus =
  | 'not_configured'
  | 'incomplete'
  | 'cert_expired'
  | 'range_exhausted'
  | 'ready';

export type DianConfigStatusResponse = {
  status: DianConfigStatus;
  readyForSend: boolean;
  missing: string[];
  hasCert: boolean;
  hasIssuerData: boolean;
  env?: DianEnvironment;
  certValidUntil?: string | null;
  nextNumber?: number;
  rangeTo?: number;
};

export type UpdateDianConfigPayload = {
  env?: DianEnvironment;
  issuerNit?: string;
  issuerName?: string;
  softwareId?: string;
  softwarePin?: string;
  resolutionNumber?: string;
  prefix?: string;
  rangeFrom?: number;
  rangeTo?: number;
};

export type UploadCertificatePayload = {
  certBase64: string;
  password: string;
};
