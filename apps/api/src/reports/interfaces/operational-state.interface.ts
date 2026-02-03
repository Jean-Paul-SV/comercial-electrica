/**
 * Estado operativo del negocio: indicadores por área y alertas con acción sugerida.
 * Ver docs/ESTADOS_OPERATIVOS_Y_ALERTAS.md
 */
export interface OperationalIndicators {
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
}

export interface OperationalAlert {
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
}

export interface OperationalStateResponse {
  indicators: OperationalIndicators;
  alerts: OperationalAlert[];
}
