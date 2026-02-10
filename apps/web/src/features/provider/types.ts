export type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  lastActivityAt: string | null;
  createdAt: string;
  plan: { id: string; name: string; slug: string } | null;
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;
  usersCount: number;
};

export type ListTenantsResponse = {
  items: TenantListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type TenantDetail = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: { id: string; name: string; slug: string } | null;
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;
  _count: {
    users: number;
    products: number;
    sales: number;
    customers: number;
  };
};

export type CreateTenantPayload = {
  name: string;
  slug: string;
  planId?: string;
  adminEmail: string;
  adminName?: string;
  adminPassword?: string;
};

export type CreateTenantResponse = {
  tenant: { id: string; name: string; slug: string };
  tempAdminPassword?: string;
};

export type PlanListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  stripePriceId: string | null;
  isActive: boolean;
};

export type UpdatePlanPayload = {
  name?: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  stripePriceId?: string | null;
  isActive?: boolean;
};
