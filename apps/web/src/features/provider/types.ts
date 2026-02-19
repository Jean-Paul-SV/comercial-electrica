export type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  billingInterval: string | null;
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
  productsCount?: number;
  salesCount?: number;
  customersCount?: number;
};

export type ListTenantsResponse = {
  items: TenantListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type UsageEventItem = {
  id: string;
  event: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  tenantId: string | null;
  tenant: { id: string; name: string; slug: string } | null;
};

export type ListUsageEventsResponse = {
  items: UsageEventItem[];
  total: number;
  limit: number;
  offset: number;
};

export type TenantDetail = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  billingInterval: string | null;
  contactPhone: string | null;
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
  billingInterval?: 'monthly' | 'yearly';
  adminEmail: string;
  adminName?: string;
  adminPassword?: string;
  issuerName?: string;
  /** Número de contacto del dueño o persona con quien comunicarse. */
  contactPhone?: string;
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
  stripePriceIdYearly: string | null;
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
  stripePriceIdYearly?: string | null;
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
  stripePriceIdYearly?: string | null;
  isActive?: boolean;
};

export type UpdateTenantPayload = {
  planId?: string;
  billingInterval?: 'monthly' | 'yearly';
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

/** Solicitud de activación DIAN pendiente (empresa con plan con DIAN que aún no ha activado el servicio). */
export type DianActivationRequest = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  planName: string;
  planSlug: string | null;
  requestedAt: string;
};

/** Sugerencia de mejora enviada por un cliente (tenant). */
export type ProviderFeedbackItem = {
  id: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  tenant: { id: string; name: string; slug: string };
  user: { id: string; email: string; name: string | null };
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
