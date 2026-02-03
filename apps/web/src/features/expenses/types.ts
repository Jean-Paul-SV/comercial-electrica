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

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

export type ExpenseKind = 'FIXED' | 'VARIABLE' | 'OTHER';

export type Expense = {
  id: string;
  amount: string | number;
  description: string;
  category: string | null;
  kind: ExpenseKind | null;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  cashSessionId: string | null;
  reference: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  cashSession?: { id: string; openedAt: string; closedAt: string | null } | null;
};

export type CreateExpensePayload = {
  amount: number;
  description: string;
  category?: string;
  kind?: ExpenseKind;
  expenseDate?: string;
  paymentMethod: PaymentMethod;
  cashSessionId?: string;
  reference?: string;
};

export type ExpenseTypeFilter = 'all' | 'compras' | 'otros';

export type ListExpensesParams = {
  startDate?: string;
  endDate?: string;
  category?: string;
  search?: string;
  expenseType?: ExpenseTypeFilter;
  kind?: ExpenseKind;
  cashSessionId?: string;
  page?: number;
  limit?: number;
};
