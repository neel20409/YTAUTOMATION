import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";
import { SubscribeButton, ManageBillingButton } from "./BillingActions";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { checkout } = await searchParams;
  const subscription = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
  const plan = subscription ? PLANS[subscription.plan] : undefined;

  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Billing</h1>

      {checkout === "success" && (
        <p className="rounded border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-700">
          Subscription started - it may take a few seconds to show up below.
        </p>
      )}
      {checkout === "cancelled" && (
        <p className="rounded border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-600">
          Checkout was cancelled.
        </p>
      )}

      {subscription ? (
        <div className="flex flex-col gap-3 rounded border px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{plan?.name ?? subscription.plan}</span>
            <span
              className={
                subscription.status === "ACTIVE"
                  ? "text-sm text-green-700"
                  : "text-sm text-amber-700"
              }
            >
              {subscription.status}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {subscription.videosUsedThisPeriod} / {subscription.videosIncludedPerPeriod} videos used
            this period
            {subscription.currentPeriodEnd &&
              ` · renews ${subscription.currentPeriodEnd.toLocaleDateString()}`}
          </div>
          <ManageBillingButton />
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded border px-4 py-4">
          <div>
            <div className="font-medium">{PLANS.pro.name}</div>
            <div className="text-sm text-gray-500">
              {PLANS.pro.videosIncludedPerPeriod} videos included per month
            </div>
          </div>
          <SubscribeButton planId="pro" />
        </div>
      )}
    </main>
  );
}
