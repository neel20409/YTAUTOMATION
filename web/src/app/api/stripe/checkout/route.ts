import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getPlan } from "@/lib/plans";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const planId = typeof body?.planId === "string" ? body.planId : "pro";
  const plan = getPlan(planId);
  if (!plan || !plan.stripePriceId) {
    return NextResponse.json({ error: `Unknown or unconfigured plan "${planId}".` }, { status: 400 });
  }

  const stripe = getStripe();
  const origin = new URL(request.url).origin;

  // Reuse an existing Stripe Customer if this user already has one (e.g. a previous checkout
  // was abandoned, or they're switching plans) instead of creating a duplicate.
  const existing = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
  const customerId =
    existing?.stripeCustomerId ??
    (
      await stripe.customers.create({
        email: session.user.email,
        metadata: { userId: session.user.id },
      })
    ).id;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${origin}/dashboard/billing?checkout=success`,
    cancel_url: `${origin}/dashboard/billing?checkout=cancelled`,
    metadata: { userId: session.user.id, planId: plan.id },
    subscription_data: {
      metadata: { userId: session.user.id, planId: plan.id },
    },
  });

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }

  return NextResponse.json({ url: checkoutSession.url });
}
