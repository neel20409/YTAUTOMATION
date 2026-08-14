import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const subscription = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
  if (!subscription) {
    return NextResponse.json({ error: "No billing account found for this user yet." }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${origin}/dashboard/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
