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
