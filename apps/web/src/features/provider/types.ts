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
  issuerName?: string;
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
  maxUsers: number | null;
  stripePriceId: string | null;
  isActive: boolean;
  /** Si el plan incluye facturación electrónica DIAN. */
  includesDian: boolean;
};

export type CreatePlanPayload = {
  name: string;
  slug: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  maxUsers?: number | null;
  stripePriceId?: string | null;
  isActive?: boolean;
  /** Incluir facturación electrónica DIAN. Si false, el plan es "sin DIAN". */
  includesDian?: boolean;
};

export type UpdatePlanPayload = {
  name?: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  maxUsers?: number | null;
  stripePriceId?: string | null;
  isActive?: boolean;
};

export type ProviderTenantsSummary = {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  plansUsage: {
    id: string;
    name: string;
    slug: string;
    tenantsCount: number;
  }[];
  modulesUsage: {
    moduleCode: string;
    tenantsCount: number;
  }[];
};

/** Alerta del panel proveedor (planes, empresas, Stripe). */
export type ProviderAlert = {
  code: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  priority: number;
  title: string;
  message: string;
  count: number;
  actionLabel: string;
  actionHref: string;
};
