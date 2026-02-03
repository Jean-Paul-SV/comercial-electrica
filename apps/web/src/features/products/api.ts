import { apiClient } from '@infrastructure/api/client';
import type {
  Paginated,
  ProductListItem,
  Product,
  CreateProductPayload,
  UpdateProductPayload,
  Category,
} from './types';

export type ProductsListParams = {
  page?: number;
  limit?: number;
  zeroStock?: boolean;
  lowStock?: boolean;
  lowStockThreshold?: number;
  minStock?: number;
  maxStock?: number;
  search?: string;
  sortByStock?: 'asc' | 'desc';
};

export function listProducts(
  params: ProductsListParams,
  authToken: string,
): Promise<Paginated<ProductListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.zeroStock === true) qs.set('zeroStock', 'true');
  if (params.lowStock === true) qs.set('lowStock', 'true');
  if (params.lowStockThreshold != null) qs.set('lowStockThreshold', String(params.lowStockThreshold));
  if (params.minStock != null) qs.set('minStock', String(params.minStock));
  if (params.maxStock != null) qs.set('maxStock', String(params.maxStock));
  if (params.search != null && params.search.trim() !== '') qs.set('search', params.search.trim());
  if (params.sortByStock != null) qs.set('sortByStock', params.sortByStock);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/products${query}`, { authToken });
}

export function getProduct(id: string, authToken: string): Promise<Product> {
  return apiClient.get(`/products/${id}`, { authToken });
}

export function createProduct(
  payload: CreateProductPayload,
  authToken: string,
): Promise<Product> {
  return apiClient.post('/products', payload, { authToken });
}

export function updateProduct(
  id: string,
  payload: UpdateProductPayload,
  authToken: string,
): Promise<Product> {
  return apiClient.patch(`/products/${id}`, payload, { authToken });
}

export function deleteProduct(id: string, authToken: string): Promise<void> {
  return apiClient.delete(`/products/${id}`, { authToken });
}

export function listCategories(authToken: string): Promise<Category[]> {
  return apiClient.get('/categories', { authToken });
}

export type CreateCategoryPayload = { name: string };

export function createCategory(
  payload: CreateCategoryPayload,
  authToken: string,
): Promise<Category> {
  return apiClient.post('/categories', payload, { authToken });
}
