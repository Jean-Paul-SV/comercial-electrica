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

export type SupplierInvoiceStatus =
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

export type SupplierInvoiceListItem = {
  id: string;
  supplierId: string;
  purchaseOrderId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: SupplierInvoiceStatus;
  subtotal: string | number;
  taxTotal: string | number;
  discountTotal: string | number;
  grandTotal: string | number;
  paidAmount: string | number;
  createdAt: string;
  updatedAt: string;
  supplier?: { id: string; name: string; nit: string };
};

export type SupplierInvoice = SupplierInvoiceListItem & {
  payments?: Array<{
    id: string;
    amount: string | number;
    paymentDate: string;
    paymentMethod: string;
    reference: string | null;
  }>;
};

export type CreateSupplierInvoicePayload = {
  supplierId: string;
  purchaseOrderId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  taxRate: number;
  discountRate?: number;
  abono?: number;
  abonoPaymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  notes?: string;
};

export type CreatePaymentPayload = {
  amount: number;
  paymentDate?: string;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  reference?: string;
  notes?: string;
};

export type PendingPaymentItem = SupplierInvoiceListItem & {
  remainingAmount: number;
  isOverdue: boolean;
  daysUntilDue: number;
};
