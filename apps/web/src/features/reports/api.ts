import { apiClient } from '@infrastructure/api/client';
import type {
  SalesReportResponse,
  InventoryReportResponse,
  CashReportResponse,
  CustomersReportResponse,
  DashboardResponse,
  ActionableIndicatorsResponse,
  ActionableIndicatorsParams,
  DashboardSummaryResponse,
  OperationalStateResponse,
  CustomerClustersResponse,
  CustomerClustersParams,
  SalesReportParams,
  InventoryReportParams,
  CashReportParams,
  CustomersReportParams,
  TrendingProductsResponse,
  TrendingProductsParams,
} from './types';

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function getSalesReport(
  params: SalesReportParams,
  authToken: string,
): Promise<SalesReportResponse> {
  return apiClient.get(`/reports/sales${buildQuery(params)}`, { authToken });
}

export function getInventoryReport(
  params: InventoryReportParams,
  authToken: string,
): Promise<InventoryReportResponse> {
  return apiClient.get(`/reports/inventory${buildQuery(params)}`, { authToken });
}

export function getCashReport(
  params: CashReportParams,
  authToken: string,
): Promise<CashReportResponse> {
  return apiClient.get(`/reports/cash${buildQuery(params)}`, { authToken });
}

export function getCustomersReport(
  params: CustomersReportParams,
  authToken: string,
): Promise<CustomersReportResponse> {
  return apiClient.get(`/reports/customers${buildQuery(params)}`, { authToken });
}

export function getDashboard(authToken: string): Promise<DashboardResponse> {
  return apiClient.get('/reports/dashboard', { authToken });
}

export function getActionableIndicators(
  authToken: string,
  params?: ActionableIndicatorsParams,
): Promise<ActionableIndicatorsResponse> {
  return apiClient.get(`/reports/actionable-indicators${buildQuery(params ?? {})}`, {
    authToken,
  });
}

export function getDashboardSummary(
  authToken: string,
  params?: ActionableIndicatorsParams,
): Promise<DashboardSummaryResponse> {
  return apiClient.get(`/reports/dashboard-summary${buildQuery(params ?? {})}`, {
    authToken,
  });
}

export function getOperationalState(
  authToken: string,
): Promise<OperationalStateResponse> {
  return apiClient.get('/reports/operational-state', { authToken });
}

export function getCustomerClusters(
  authToken: string,
  params?: CustomerClustersParams,
): Promise<CustomerClustersResponse> {
  return apiClient.get(`/reports/customer-clusters${buildQuery(params ?? {})}`, {
    authToken,
  });
}

export function getTrendingProducts(
  params: TrendingProductsParams,
  authToken: string,
): Promise<TrendingProductsResponse> {
  return apiClient.get(`/reports/trending-products${buildQuery(params ?? {})}`, {
    authToken,
  });
}

/** Parámetros para exportar reporte a CSV (GET /reports/export) */
export type ExportReportParams = {
  entity: 'sales' | 'customers';
  startDate?: string;
  endDate?: string;
  limit?: number;
};

const API_BASE_URL =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'
    : 'http://localhost:3000';

/** Descarga CSV de ventas o clientes; dispara la descarga en el navegador. */
export async function downloadExportCsv(
  authToken: string,
  params: ExportReportParams,
): Promise<void> {
  const qs = new URLSearchParams();
  qs.set('entity', params.entity);
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  if (params.limit != null) qs.set('limit', String(params.limit));
  const url = `${API_BASE_URL}/reports/export?${qs.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = 'Error al exportar';
    try {
      const json = JSON.parse(text);
      message = json?.message ?? json?.error ?? message;
    } catch {
      message = text || message;
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  let fileName = `export-${params.entity}-${new Date().toISOString().slice(0, 10)}.csv`;
  if (disposition) {
    const match = /filename="?([^";\n]+)"?/.exec(disposition);
    if (match?.[1]) fileName = match[1].trim();
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}
