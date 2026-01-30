export type SalesReportResponse = {
  period?: { startDate?: string; endDate?: string };
  summary: {
    totalSales: number;
    totalAmount: number;
    averageSale?: number;
    [key: string]: unknown;
  };
  sales?: Array<{
    id: string;
    soldAt: string;
    grandTotal: string | number;
    customer?: { name: string };
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type InventoryReportResponse = {
  filters?: { lowStock?: boolean; lowStockThreshold?: number; categoryId?: string };
  statistics?: {
    totalProducts: number;
    productsWithStock?: number;
    productsLowStock?: number;
    totalStockValue?: number;
    [key: string]: unknown;
  };
  products?: Array<{
    id: string;
    internalCode: string;
    name: string;
    category?: string;
    cost: number;
    price: number;
    stock?: { qtyOnHand: number; qtyReserved: number; available: number } | null;
    stockValue?: number;
    hasSales?: boolean;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type CashReportResponse = {
  period?: { startDate?: string; endDate?: string; sessionId?: string };
  summary?: {
    totalSessions?: number;
    openSessions?: number;
    totalIn?: number;
    totalOut?: number;
    totalAdjust?: number;
    netAmount?: number;
    totalDifference?: number;
    [key: string]: unknown;
  };
  sessions?: Array<{
    id: string;
    openedAt: string;
    closedAt: string | null;
    openingAmount: number;
    closingAmount: number | null;
    movements?: {
      total: number;
      totalIn: number;
      totalOut: number;
      totalAdjust?: number;
      netAmount: number;
      totalsByMethod?: Record<string, number>;
    };
    expectedAmount?: number;
    difference?: number;
    isOpen?: boolean;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type CustomersReportResponse = {
  period?: { startDate?: string; endDate?: string };
  totalCustomers?: number;
  topCustomers?: Array<{
    customer: { id: string; name: string; docType?: string; docNumber: string; email?: string | null };
    statistics: { totalSales: number; totalAmount: number; averageSale: number; lastSaleDate: string | null };
  }>;
  [key: string]: unknown;
};

export type DashboardResponse = {
  date?: string;
  sales?: {
    today?: { count?: number; total?: number };
  };
  inventory?: {
    totalProducts?: number;
    lowStockCount?: number;
    lowStockProducts?: Array<{ id: string; name: string; stock: number; category?: string }>;
  };
  cash?: {
    openSessions?: number;
    sessions?: Array<{ id: string; openedAt: string; openingAmount: number; movementsCount: number }>;
  };
  quotes?: {
    pending?: number;
    expiringSoon?: number;
  };
  customers?: { total?: number };
  [key: string]: unknown;
};

export type SalesReportParams = {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  limit?: number;
};

export type InventoryReportParams = {
  lowStock?: boolean;
  lowStockThreshold?: number;
  categoryId?: string;
};

export type CashReportParams = {
  sessionId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export type CustomersReportParams = {
  startDate?: string;
  endDate?: string;
  top?: number;
};
