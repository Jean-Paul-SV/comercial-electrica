export type SubscriptionInfo = {
  plan: { name: string; slug: string } | null;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
  } | null;
  /** Si true, el usuario puede abrir el portal de Stripe. */
  canManageBilling: boolean;
};

export type PortalSessionResponse = {
  url: string;
};
