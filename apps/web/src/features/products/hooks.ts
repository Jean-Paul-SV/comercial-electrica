'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  listCategories,
  createCategory,
  type ProductsListParams,
  type CreateCategoryPayload,
} from './api';
import type { CreateProductPayload, UpdateProductPayload } from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useProductsList(params: ProductsListParams) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['products', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listProducts(params, token!),
  });
}

export function useProduct(id: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['products', id],
    enabled: Boolean(token && id),
    queryFn: () => getProduct(id!, token!),
  });
}

export function useCategories() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['categories'],
    enabled: Boolean(token),
    queryFn: () => listCategories(token!),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateCategoryPayload) =>
      createCategory(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateProductPayload) =>
      createProduct(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateProductPayload;
    }) => updateProduct(id, payload, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', variables.id] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
