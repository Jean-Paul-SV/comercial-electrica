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

export type CustomerDocType = 'CC' | 'CE' | 'NIT' | 'PASSPORT' | 'OTHER';

export type CustomerListItem = {
  id: string;
  docType: CustomerDocType;
  docNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  cityCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Customer = CustomerListItem;

export type CreateCustomerPayload = {
  docType: CustomerDocType;
  docNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  cityCode?: string;
};

export type UpdateCustomerPayload = Partial<
  Omit<CreateCustomerPayload, 'docType' | 'docNumber'>
>;
