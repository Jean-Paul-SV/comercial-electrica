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
  listProductDictionary,
  createProductDictionaryEntry,
  updateProductDictionaryEntry,
  deleteProductDictionaryEntry,
  updateCategory,
  deleteCategory,
  type ProductsListParams,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
} from './api';
import type {
  CreateProductPayload,
  UpdateProductPayload,
  ProductDictionaryListParams,
  CreateProductDictionaryEntryPayload,
  UpdateProductDictionaryEntryPayload,
} from './types';
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

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCategoryPayload }) =>
      updateCategory(id, payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id, token!),
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

// --- Diccionario de búsqueda ---

export function useProductDictionary(params: ProductDictionaryListParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['product-dictionary', params],
    enabled: Boolean(token),
    queryFn: () => listProductDictionary(params, token!),
  });
}

export function useCreateProductDictionaryEntry() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateProductDictionaryEntryPayload) =>
      createProductDictionaryEntry(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-dictionary'] });
    },
  });
}

export function useUpdateProductDictionaryEntry() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateProductDictionaryEntryPayload;
    }) => updateProductDictionaryEntry(id, payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-dictionary'] });
    },
  });
}

export function useDeleteProductDictionaryEntry() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (id: string) => deleteProductDictionaryEntry(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-dictionary'] });
    },
  });
}
