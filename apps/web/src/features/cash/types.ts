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

export type CashSessionListItem = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: string | number;
  closingAmount: string | number;
  openedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CashSession = CashSessionListItem;

export type CashMovement = {
  id: string;
  sessionId: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  method: string;
  amount: string | number;
  reference: string | null;
  relatedSaleId: string | null;
  relatedExpense?: { id: string; description: string; amount: string | number } | null;
  createdAt: string;
};

export type CashMovementWithSession = CashMovement & {
  session: {
    id: string;
    openedAt: string;
    closedAt: string | null;
  };
};

export type OpenSessionPayload = {
  openingAmount: number;
};

export type CloseSessionPayload = {
  closingAmount: number;
};

export type CreateMovementPayload = {
  type: 'IN' | 'OUT' | 'ADJUST';
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  amount: number;
  reference?: string;
};
