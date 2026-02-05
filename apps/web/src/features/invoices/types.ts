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

/** Estado de factura de venta (Invoice) */
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'VOIDED';

export type InvoiceListItem = {
  id: string;
  number: string;
  issuedAt: string;
  status: InvoiceStatus;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  saleId: string | null;
  customerId: string | null;
  customer: { id: string; name: string } | null;
  sale: { id: string; soldAt: string } | null;
};
