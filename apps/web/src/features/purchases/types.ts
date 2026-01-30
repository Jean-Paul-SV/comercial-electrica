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

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SENT'
  | 'RECEIVED'
  | 'PARTIALLY_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PurchaseOrderItem = {
  id: string;
  purchaseOrderId: string;
  productId: string;
  qty: number;
  unitCost: string | number;
  taxRate: string | number;
  lineTotal: string | number;
  receivedQty: number;
  product?: { name: string; internalCode?: string };
};

export type PurchaseOrderListItem = {
  id: string;
  supplierId: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string | null;
  receivedDate: string | null;
  notes: string | null;
  subtotal: string | number;
  taxTotal: string | number;
  discountTotal: string | number;
  grandTotal: string | number;
  createdAt: string;
  updatedAt: string;
  supplier?: { id: string; name: string; nit: string };
  items?: PurchaseOrderItem[];
};

export type PurchaseOrder = PurchaseOrderListItem;

export type CreatePurchaseOrderItemPayload = {
  productId: string;
  qty: number;
  unitCost: number;
  taxRate?: number;
};

export type CreatePurchaseOrderPayload = {
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  items: CreatePurchaseOrderItemPayload[];
};

export type ReceivePurchaseOrderItemPayload = {
  itemId: string;
  receivedQty: number;
};

export type ReceivePurchaseOrderPayload = {
  receivedDate?: string;
  items: ReceivePurchaseOrderItemPayload[];
};
