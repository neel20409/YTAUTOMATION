import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";
import { Card } from "@/components/ui";
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
  const usagePct = subscription
    ? Math.min(100, Math.round((subscription.videosUsedThisPeriod / Math.max(subscription.videosIncludedPerPeriod, 1)) * 100))
    : 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <Link href="/dashboard" className="text-sm text-dim hover:text-paper">
          ← Back to channels
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold text-paper">Billing</h1>
      </div>

      {checkout === "success" && (
        <p className="rounded-lg border border-phosphor/40 bg-phosphor-dim/40 px-4 py-3 text-sm text-phosphor">
          Subscription started - it may take a few seconds to show up below.
        </p>
      )}
      {checkout === "cancelled" && (
        <p className="rounded-lg border border-line bg-panel-2 px-4 py-3 text-sm text-dim">
          Checkout was cancelled.
        </p>
      )}

      {subscription ? (
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-semibold text-paper">{plan?.name ?? subscription.plan}</span>
            <span
              className={
                "rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide " +
                (subscription.status === "ACTIVE"
                  ? "border-phosphor/40 bg-phosphor-dim/40 text-phosphor"
                  : "border-standby/40 bg-standby-dim/40 text-standby")
              }
            >
              {subscription.status}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-dim">Videos this period</span>
              <span className="font-mono text-paper">
                {subscription.videosUsedThisPeriod} / {subscription.videosIncludedPerPeriod}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full bg-signal" style={{ width: `${usagePct}%` }} />
            </div>
            {subscription.currentPeriodEnd && (
              <p className="text-xs text-dim">
                Renews {subscription.currentPeriodEnd.toLocaleDateString()}
              </p>
            )}
          </div>

          <ManageBillingButton />
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-paper">{PLANS.pro.name}</h2>
            <p className="mt-1 text-sm text-dim">{PLANS.pro.videosIncludedPerPeriod} videos included per month</p>
          </div>
          <SubscribeButton planId="pro" />
        </Card>
      )}
    </main>
  );
}
