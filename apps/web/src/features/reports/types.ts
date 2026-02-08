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

// Indicadores accionables (GET /reports/actionable-indicators)
export type ActionableIndicatorItem = {
  id: string;
  name: string;
  value?: number | string;
  /** Precio mínimo sugerido para margen objetivo (ej. 15 %). Solo en productos con pérdida o margen bajo. */
  suggestedPrice?: number;
  /** Total en ventas (numérico). Solo en indicador SALES_BY_EMPLOYEE para gráficos. */
  totalSales?: number;
  /** Stock (unidades en mano). Solo en indicador PRODUCTS_NO_ROTATION. */
  stock?: number;
};

export type ActionableIndicator = {
  code: string;
  title: string;
  insight: string;
  metric: string | number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  suggestedAction: string;
  actionLabel: string;
  actionHref: string;
  items: ActionableIndicatorItem[];
  detectedAt: string;
};

export type ActionableIndicatorsResponse = {
  periodDays: number;
  indicators: ActionableIndicator[];
};

export type ActionableIndicatorsParams = {
  days?: number;
  top?: number;
  startDate?: string;
  endDate?: string;
};

// Resumen del dashboard en lenguaje natural (GET /reports/dashboard-summary)
export type DashboardSummaryResponse = {
  summary: string;
  source: 'llm' | 'fallback';
};

// Estado operativo (GET /reports/operational-state)
export type OperationalIndicators = {
  cash: {
    openSessionsCount: number;
    hasOpenSession: boolean;
    oldestOpenAt: string | null;
  };
  inventory: {
    lowStockCount: number;
    zeroStockCount: number;
  };
  quotes: {
    pendingCount: number;
    expiringSoonCount: number;
    expiredCount: number;
  };
  sales: {
    todayCount: number;
    todayTotal: number;
    avgDailyTotalLast7: number;
  };
  supplierInvoices: {
    overdueCount: number;
    dueSoonCount: number;
  };
};

export type OperationalAlert = {
  code: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  priority: number;
  title: string;
  message: string;
  area: string;
  count: number;
  actionLabel: string;
  actionHref: string;
  entityIds: string[];
  detectedAt: string;
};

export type OperationalStateResponse = {
  indicators: OperationalIndicators;
  alerts: OperationalAlert[];
};

// Clustering de clientes K-means (GET /reports/customer-clusters)
export type CustomerClustersParams = {
  days?: number;
  k?: number;
};

export type CustomerClustersResponse = {
  periodDays: number;
  k: number;
  clusters: Array<{
    clusterIndex: number;
    label: string;
    suggestedLabel: string;
    description: string;
    customers: Array<{ id: string; name: string }>;
    avgAmount: number;
    avgDaysAgo: number;
    avgCount: number;
  }>;
};

// Artículos en tendencias (GET /reports/trending-products)
export type TrendingProductsParams = {
  days?: number;
  top?: number;
  sortBy?: 'revenue' | 'qty';
  period?: 'last_days' | 'current_month';
  /** Período por mes: si se envían, se usa este rango en lugar de period/days */
  startDate?: string;
  endDate?: string;
};

export type TrendingProductsResponse = {
  periodDays: number;
  period?: 'last_days' | 'current_month';
  sortBy?: 'revenue' | 'qty';
  items: Array<{
    product: {
      id: string;
      internalCode: string;
      name: string;
      category: { name: string } | null;
      price: number | string;
    };
    totalRevenue: number;
    totalQty: number;
    salesCount: number;
  }>;
};
