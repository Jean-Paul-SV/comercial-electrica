export type SubscriptionInfo = {
  plan: { id: string; name: string; slug: string } | null;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
  } | null;
  /** Si true, el usuario puede abrir el portal de Stripe. */
  canManageBilling: boolean;
  /** Si true, la app se muestra bloqueada; solo se muestra la pantalla de pagar. */
  requiresPayment: boolean;
};

export type PortalSessionResponse = {
  url: string;
};

export type BillingPlan = {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number | null;
  priceYearly: number | null;
  maxUsers: number | null;
};
