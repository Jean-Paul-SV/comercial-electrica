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
