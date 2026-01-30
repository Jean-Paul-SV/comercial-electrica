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

export type ReturnListItem = {
  id: string;
  saleId: string;
  returnedAt: string;
  reason: string | null;
  subtotal: string | number;
  taxTotal: string | number;
  grandTotal: string | number;
  createdAt: string;
  updatedAt: string;
  sale?: {
    id: string;
    soldAt: string;
    grandTotal: string | number;
    customer?: { id: string; name: string } | null;
  };
  items?: Array<{
    id: string;
    productId: string;
    qty: number;
    unitPrice: string | number;
    lineTotal: string | number;
    product?: { name: string };
  }>;
};

export type CreateReturnItemPayload = {
  productId: string;
  qty: number;
};

export type CreateReturnPayload = {
  saleId: string;
  reason?: string;
  items: CreateReturnItemPayload[];
};
