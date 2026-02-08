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

export type SupplierListItem = {
  id: string;
  nit: string;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  cityCode: string | null;
  contactPerson: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Supplier = SupplierListItem;

export type CreateSupplierPayload = {
  nit: string;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  cityCode?: string;
  contactPerson?: string;
};

export type UpdateSupplierPayload = Partial<CreateSupplierPayload> & {
  isActive?: boolean;
};
