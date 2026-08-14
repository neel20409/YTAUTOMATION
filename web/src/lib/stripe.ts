import Stripe from "stripe";

let _stripe: Stripe | undefined;

// Lazy for the same reason as src/lib/prisma.ts's driver adapter and worker/src/db.ts's Prisma
// client: constructing this at module-load time would read STRIPE_SECRET_KEY before env vars
// are guaranteed to be loaded (and would throw at import time in any route that merely imports
// this file, even ones that don't use Stripe on a given request).
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    _stripe = new Stripe(key);
  }
  return _stripe;
}
