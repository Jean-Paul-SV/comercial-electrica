'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getSalesReport,
  getInventoryReport,
  getCashReport,
  getCustomersReport,
  getDashboard,
} from './api';
import type {
  SalesReportParams,
  InventoryReportParams,
  CashReportParams,
  CustomersReportParams,
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

export function useDashboard() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['reports', 'dashboard'],
    enabled: Boolean(token),
    queryFn: () => getDashboard(token!),
  });
}
