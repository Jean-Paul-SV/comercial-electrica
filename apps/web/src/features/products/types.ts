export type Paginated<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type ProductListItem = {
  id: string;
  internalCode: string;
  name: string;
  categoryId: string | null;
  cost: string | number;
  price: string | number;
  taxRate: string | number;
  minStock?: number | null;
  isActive: boolean;
  category?: { id: string; name: string } | null;
  stock?: { productId: string; qtyOnHand: number; qtyReserved: number } | null;
};

export type Product = ProductListItem & {
  createdAt: string;
  updatedAt: string;
};

export type CreateProductPayload = {
  internalCode: string;
  name: string;
  categoryId?: string | null;
  cost: number;
  price: number;
  taxRate?: number;
  minStock?: number | null;
};

export type UpdateProductPayload = Partial<CreateProductPayload> & {
  isActive?: boolean;
  minStock?: number | null;
};

export type Category = {
  id: string;
  name: string;
};

// Diccionario de términos que los clientes escriben al preguntar por productos
export type ProductDictionaryEntry = {
  id: string;
  term: string;
  productId: string | null;
  categoryId: string | null;
  createdAt: string;
  product?: { id: string; name: string; internalCode: string } | null;
  category?: { id: string; name: string } | null;
};

export type ProductDictionaryListParams = {
  search?: string;
  productId?: string;
  categoryId?: string;
};

export type CreateProductDictionaryEntryPayload = {
  term: string;
  productId?: string | null;
  categoryId?: string | null;
};

export type UpdateProductDictionaryEntryPayload = {
  productId?: string | null;
  categoryId?: string | null;
};
