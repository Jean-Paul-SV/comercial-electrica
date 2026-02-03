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

export type MovementType = 'IN' | 'OUT' | 'ADJUST';

export type InventoryMovementItem = {
  id: string;
  movementId: string;
  productId: string;
  qty: number;
  unitCost: string | number | null;
  product?: { name: string; internalCode?: string };
};

export type InventoryMovementListItem = {
  id: string;
  type: MovementType;
  reason: string | null;
  supplierId: string | null;
  supplier?: { id: string; name: string } | null;
  createdBy: string | null;
  createdAt: string;
  items?: InventoryMovementItem[];
};

export type CreateMovementItemPayload = {
  productId: string;
  qty: number;
  unitCost?: number;
};

export type CreateMovementPayload = {
  type: MovementType;
  reason?: string;
  supplierId?: string;
  items: CreateMovementItemPayload[];
};
