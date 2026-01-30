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
};

