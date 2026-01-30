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

export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'EXPIRED'
  | 'CONVERTED'
  | 'CANCELLED';

export type QuoteListItem = {
  id: string;
  customerId: string | null;
  status: QuoteStatus;
  validUntil: string | null;
  subtotal: string | number;
  taxTotal: string | number;
  discountTotal: string | number;
  grandTotal: string | number;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string } | null;
  items?: Array<{
    id: string;
    productId: string;
    qty: number;
    unitPrice: string | number;
    lineTotal: string | number;
    product?: { name: string; internalCode?: string };
  }>;
};

export type Quote = QuoteListItem;

export type CreateQuoteItemPayload = {
  productId: string;
  qty: number;
  unitPrice?: number;
};

export type CreateQuotePayload = {
  customerId?: string;
  validUntil?: string;
  items: CreateQuoteItemPayload[];
};

export type UpdateQuotePayload = {
  customerId?: string;
  validUntil?: string;
  items?: CreateQuoteItemPayload[];
};

export type ConvertQuotePayload = {
  cashSessionId: string;
  paymentMethod?: string;
};

export type ConvertQuoteResponse = {
  quote: unknown;
  sale: unknown;
  invoice: { id: string; number: string };
  dianDocument: unknown;
};
