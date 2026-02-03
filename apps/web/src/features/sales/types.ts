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

export type SaleListItem = {
  id: string;
  soldAt: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  customer?: { id: string; name: string } | null;
  invoices?: Array<{ id: string; number: string }>;
  createdBy?: { id: string; email: string } | null;
};

export type CreateSaleItemPayload = {
  productId: string;
  qty: number;
  unitPrice?: number;
};

export type CreateSalePayload = {
  customerId?: string;
  cashSessionId: string;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  items: CreateSaleItemPayload[];
  /** Descuento total en COP (opcional). Se resta del total. */
  discountTotal?: number;
};

/** Respuesta al crear una venta (sale, invoice, dianDocument) */
export type CreateSaleResponse = {
  sale: {
    id: string;
    customerId: string | null;
    subtotal: number;
    taxTotal: number;
    grandTotal: number;
    items: Array<{
      productId: string;
      qty: number;
      unitPrice?: number;
      lineTotal?: number;
    }>;
    customer?: { id: string; name: string } | null;
  };
  invoice: {
    id: string;
    number: string;
    issuedAt: string;
    subtotal: number;
    taxTotal: number;
    grandTotal: number;
  };
  dianDocument: { id: string };
};

