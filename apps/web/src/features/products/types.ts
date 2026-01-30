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
};

export type UpdateProductPayload = Partial<CreateProductPayload> & {
  isActive?: boolean;
};

export type Category = {
  id: string;
  name: string;
};
