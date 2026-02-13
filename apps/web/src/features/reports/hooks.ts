'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getSalesReport,
  getInventoryReport,
  getCashReport,
  getCustomersReport,
  getDashboard,
  getActionableIndicators,
  getDashboardSummary,
  getOperationalState,
  getCustomerClusters,
  getTrendingProducts,
  downloadExportCsv,
} from './api';
import type { GetDashboardParams } from './api';
import type { ExportReportParams } from './api';
import type {
  SalesReportParams,
  InventoryReportParams,
  CashReportParams,
  CustomersReportParams,
  ActionableIndicatorsParams,
  CustomerClustersParams,
  TrendingProductsParams,
} from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useSalesReport(params: SalesReportParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reports', 'sales', params],
    enabled: Boolean(token),
    queryFn: () => getSalesReport(params, token!),
  });
}

export function useInventoryReport(params: InventoryReportParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reports', 'inventory', params],
    enabled: Boolean(token),
    queryFn: () => getInventoryReport(params, token!),
  });
}

export function useCashReport(params: CashReportParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reports', 'cash', params],
    enabled: Boolean(token),
    queryFn: () => getCashReport(params, token!),
  });
}

export function useCustomersReport(params: CustomersReportParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reports', 'customers', params],
    enabled: Boolean(token),
    queryFn: () => getCustomersReport(params, token!),
  });
}

export function useDashboard(params?: GetDashboardParams) {
  const { token } = useAuth();
  const lowStockThreshold = params?.lowStockThreshold;

  return useQuery({
    queryKey: ['reports', 'dashboard', lowStockThreshold],
    enabled: Boolean(token),
    queryFn: () => getDashboard(token!, params),
    staleTime: 90_000, // 1.5 min: dashboard no cambia tan seguido
  });
}

export function useActionableIndicators(params: ActionableIndicatorsParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reports', 'actionable-indicators', params],
    enabled: Boolean(token),
    queryFn: () => getActionableIndicators(token!, params),
    staleTime: 0, // Siempre considerar datos obsoletos para refrescar
    refetchInterval: 30_000, // Refrescar cada 30 s (tiempo casi real)
    refetchOnWindowFocus: true, // Refrescar al volver a la pestaña
  });
}

export function useDashboardSummary(params: ActionableIndicatorsParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reports', 'dashboard-summary', params],
    enabled: Boolean(token),
    queryFn: () => getDashboardSummary(token!, params),
    staleTime: 90_000,
  });
}

export function useOperationalState() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reports', 'operational-state'],
    enabled: Boolean(token),
    queryFn: () => getOperationalState(token!),
  });
}

export function useCustomerClusters(params: CustomerClustersParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reports', 'customer-clusters', params],
    enabled: Boolean(token),
    queryFn: () => getCustomerClusters(token!, params),
  });
}

export function useTrendingProducts(params: TrendingProductsParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reports', 'trending-products', params],
    enabled: Boolean(token),
    queryFn: () => getTrendingProducts(params, token!),
  });
}

export function useExportReportCsv() {
  const { token } = useAuth();

  return useMutation({
    mutationFn: (params: ExportReportParams) =>
      downloadExportCsv(token!, params),
  });
}
