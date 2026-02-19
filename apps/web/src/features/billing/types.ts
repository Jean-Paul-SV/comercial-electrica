export type SubscriptionInfo = {
  plan: { id: string; name: string; slug: string } | null;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
  } | null;
  /** Plan programado para downgrade; vigente a partir de scheduledChangeAt. */
  scheduledPlan: { id: string; name: string; slug: string } | null;
  /** Fecha en que se aplicará el cambio programado (ISO). */
  scheduledChangeAt: string | null;
  /** Si true, el usuario puede abrir el portal de Stripe. */
  canManageBilling: boolean;
  /** Si true, la app se muestra bloqueada; solo se muestra la pantalla de pagar. */
  requiresPayment: boolean;
};

export type ChangePlanResult = {
  success: boolean;
  /** Si el cambio es diferido (downgrade), fecha en que se aplicará (ISO). */
  scheduledChangeAt?: string;
};

export type PortalSessionResponse = {
  url: string;
};

export type BillingPlan = {
  id: string;
  name: string;
  slug: string;
  /** Descripción del plan para que el cliente vea qué incluye y en qué se diferencia de otros. */
  description: string | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  maxUsers: number | null;
};
