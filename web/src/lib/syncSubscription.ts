import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getPlanByPriceId } from "@/lib/plans";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

// Stripe's subscription states are more granular than our SubscriptionStatus enum - collapse to
// the four states the rest of the app (usage-cap checks, dashboard messaging) actually branches
// on. `paused` has no great fit; treated as INCOMPLETE (not currently usable) rather than adding
// a fifth enum value for a state we don't otherwise act on differently.
function toSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}

/**
 * Upserts our Subscription row from a Stripe Subscription object - shared by the
 * checkout.session.completed and customer.subscription.* webhook handlers, since both need to
 * write the same fields whenever Stripe's view of the subscription changes.
 */
export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  userIdHint?: string
): Promise<void> {
  const userId = userIdHint ?? subscription.metadata?.userId;
  if (!userId) {
    console.error(`Stripe subscription ${subscription.id} has no userId in metadata - cannot sync.`);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  const plan = priceId ? getPlanByPriceId(priceId) : undefined;
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      plan: plan?.id ?? subscription.metadata?.planId ?? "unknown",
      status: toSubscriptionStatus(subscription.status),
      videosIncludedPerPeriod: plan?.videosIncludedPerPeriod ?? 0,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      plan: plan?.id ?? subscription.metadata?.planId ?? "unknown",
      status: toSubscriptionStatus(subscription.status),
      videosIncludedPerPeriod: plan?.videosIncludedPerPeriod ?? 0,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
    },
  });
}
