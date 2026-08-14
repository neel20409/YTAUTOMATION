// Starting shape: one plan. Deliberately keyed by an internal `id` (stored in
// Subscription.plan) rather than the Stripe price id directly, so the Stripe price can be
// changed/reissued in the Stripe dashboard without a code or data migration - only this map's
// `stripePriceId` needs updating. Real numbers (video cap, price) are placeholders until actual
// per-video paid-API cost is measured; change them here and in the Stripe dashboard together.
export interface Plan {
  id: string;
  name: string;
  stripePriceId: string;
  videosIncludedPerPeriod: number;
}

export const PLANS: Record<string, Plan> = {
  pro: {
    id: "pro",
    name: "Pro",
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO ?? "",
    videosIncludedPerPeriod: 30,
  },
};

export function getPlanByPriceId(priceId: string): Plan | undefined {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId);
}

export function getPlan(id: string): Plan | undefined {
  return PLANS[id];
}
