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
};

export function listProducts(
  params: ProductsListParams,
  authToken: string,
): Promise<Paginated<ProductListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
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
