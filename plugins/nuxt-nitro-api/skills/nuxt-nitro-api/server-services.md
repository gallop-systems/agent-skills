# Server-Side Service Integrations

> **Example:** [service-util.ts](./examples/service-util.ts)

Composable-style utilities for third-party services in `/server/utils/`.

## Basic Pattern

```typescript
// server/utils/stripe.ts
import Stripe from "stripe";

// Initialize at module level with runtime config
const config = useRuntimeConfig();
const stripe = new Stripe(config.stripe.secretKey);

// Define typed methods
async function createPaymentIntent(options: {
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}) {
  return stripe.paymentIntents.create({
    amount: options.amount,
    currency: options.currency,
    metadata: options.metadata,
  });
}

async function getCustomer(customerId: string) {
  return stripe.customers.retrieve(customerId);
}

// Export as use*()
export function useStripe() {
  return { createPaymentIntent, getCustomer, client: stripe };
}
```

## Usage in API Handlers

```typescript
// server/api/checkout/create.post.ts
import { z } from "zod";

export default defineEventHandler(async (event) => {
  const { amount, currency } = await readValidatedBody(event, z.object({
    amount: z.number().int().positive(),
    currency: z.enum(["usd", "eur"]),
  }).parse); // never raw readBody + destructure: see validation.md

  const { createPaymentIntent } = useStripe();

  const intent = await createPaymentIntent({
    amount,
    currency,
    metadata: { source: "web" },
  });

  return { clientSecret: intent.client_secret };
});
```

## Service Composition

Services can use other services:

```typescript
// server/utils/orders.ts
export function useOrders() {
  const db = useDatabase();
  const { createPaymentIntent } = useStripe();

  async function createOrder(userId: number, items: CartItem[]) {
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Create payment intent with Stripe
    const paymentIntent = await createPaymentIntent({
      amount: total,
      currency: "usd",
      metadata: { userId: String(userId) },
    });

    // Save order to database
    const order = await db
      .insertInto("orders")
      .values({
        user_id: userId,
        total,
        stripe_payment_intent_id: paymentIntent.id,
        status: "pending",
      })
      .returning(["id"])
      .executeTakeFirst();

    return { order, clientSecret: paymentIntent.client_secret };
  }

  return { createOrder };
}
```

## Lazy Initialization

For expensive clients:

```typescript
// server/utils/redis.ts
let redis: Redis | null = null;

export function useRedis(): Redis {
  if (!redis) {
    const config = useRuntimeConfig();

    if (!config.redis?.url) {
      throw new Error("NUXT_REDIS_URL not configured");
    }

    redis = new Redis(config.redis.url);
    redis.on("error", (err) => console.error("Redis error:", err));
    redis.on("connect", () => console.log("Redis connected"));
  }

  return redis;
}

// Health check
export async function isRedisAvailable(): Promise<boolean> {
  try {
    await useRedis().ping();
    return true;
  } catch {
    return false;
  }
}
```

## Error Handling

```typescript
// server/utils/error-handling.ts
export function formatServiceError(error: unknown, service: string) {
  const err = error as any;

  // PostgreSQL constraint violations
  if (err?.code === "23505") {
    return { status: 409, message: "Resource already exists" };
  }
  if (err?.code === "23503") {
    return { status: 400, message: "Referenced resource not found" };
  }

  // Network errors
  if (err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT") {
    return { status: 503, message: `${service} service unavailable` };
  }

  // API errors
  if (err?.response?.status) {
    return { status: err.response.status, message: err.message };
  }

  return { status: 500, message: `${service} error: ${err?.message}` };
}

// Usage
async function callExternalApi() {
  try {
    return await client.doSomething();
  } catch (error) {
    const { status, message } = formatServiceError(error, "Stripe");
    throw createError({ statusCode: status, message });
  }
}
```

## Failures from third-party calls

The shape reviewers flag most in service code: a catch or a status check that turns
a **failure** into a normal-looking result ("not found", "empty", "disconnected",
"done"), which the caller then acts on.

```typescript
// ❌ every error becomes "no such folder", so the caller creates a duplicate
async function findFolder(name: string) {
  try { return await drive.find(name); } catch { return null; }
}

// ✅ only a real not-found means absent; everything else propagates
async function findFolder(name: string) {
  try {
    return await drive.find(name);
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}
```

- **Only not-found is absence.** Timeouts, 5xx, 429 and auth errors on a lookup are
  failures. Never create, delete, or report "no access" on the strength of a
  lookup that failed.
- **A 2xx without the expected object is a failure**, not a completed read (an
  empty body, a missing `items` key, a wrapper with `error` inside).
- **A 401/403 for one resource is local.** One mailbox, calendar or user the
  integration can't reach doesn't mean the whole connection is down: mark that item,
  keep going, and only flip "disconnected" on an auth failure of the connection itself.
- **Batches: isolate items.** One bad item (or one chunk's unreadable response body)
  must not fail the whole batch. Collect per-item results, retry the failing chunk
  item by item if the API is all-or-nothing, and report partial success as partial.
- **Map known upstream rejections to the right status** (a provider's "too large" to
  413, "not found" to 404) instead of a generic 502/500, so the client can say why.
- **Third-party contracts:** handle every status representation the provider
  documents (string *and* numeric codes, new enum values), detect state changes by
  the documented field rather than an inferred one (a zero total is not "voided"),
  and re-validate a stored remote id before reusing it, since the remote side can
  delete or move it.
- **Log allowlisted fields, never the whole error.** SDK errors carry request
  headers, tokens and payloads; logs are not the place for emails or other personal
  identifiers. Log `{ service, status, code, requestId }`.

### Timeouts and best-effort work

An outbound call without a timeout can hang the request (or a job's claim) for
minutes. `Promise.race` against a timer **does not cancel** the call; it keeps
running and holding whatever it holds. Put the timeout on the call itself:

```typescript
await $fetch(url, { timeout: 5_000 });                 // ofetch; ignored if you also pass `signal`, and it stops
                                                       // at the response headers: a stalled body is not covered
await $fetch(url, { signal: AbortSignal.timeout(5_000) }); // covers the body read too
await fetch(url, { signal: AbortSignal.timeout(5_000) }); // native fetch
// SDKs: use the client's own timeout option
```

Don't block a response on best-effort work (a chat notification, an analytics ping,
a "last seen" refresh). Hand it to Nitro and return:

```typescript
event.waitUntil(notifyChannel(payment).catch((e) => console.error("notify failed", e.message)));
return { ok: true };
```

(`event.waitUntil` is Nitro v2's; on serverless runtimes it extends the invocation,
on Node it just tracks the promise. Always `.catch`: nobody awaits it.)

## Multi-step operations with side effects

When one handler or job does several writes, some of them external (create a folder,
send an email, post to an API), order matters because external writes can't be
rolled back with the DB transaction:

1. **Validate everything first.** Every input, every referenced record, every
   refusal check, before the first mutation. Cleanup or "prep" steps go after the
   checks, so a refused request changes nothing.
2. **DB work in one transaction** (see Transaction Pattern below), external calls
   outside it, so a slow API doesn't hold row locks.
3. **Record intent before delivery** (an outbox/guard row inserted first, delivery
   marked done after). The guard that stops re-runs must not also stop a **retry** of a
   delivery that failed: track delivery state separately from "already processed".
   A retry after "sent but not yet marked done" sends twice, so pass the provider a
   stable idempotency key (the outbox row's id) where it accepts one.
4. **Idempotency keys cover the whole payload.** When a replay is detected by key,
   compare every field that affects the result and reject a replay whose payload
   differs, instead of returning the first result for a different request.
5. **Conditional external writes.** If you validated against a remote version/etag,
   send it on the write (`If-Match`) so a concurrent edit isn't overwritten.

## Transaction Pattern

```typescript
// server/utils/invoices.ts
export function useInvoices() {
  const db = useDatabase();

  async function createInvoice(params: CreateParams) {
    return await db.transaction().execute(async (trx) => {
      // All operations use trx, not db
      const invoice = await trx
        .insertInto("invoice")
        .values(params)
        .returning(["id"])
        .executeTakeFirst();

      await trx
        .updateTable("session")
        .set({ invoice_id: invoice.id, locked: true })
        .where("id", "in", params.sessionIds)
        .execute();

      return invoice;
    });
  }

  return { createInvoice };
}
```

## Common Structure

```typescript
// server/utils/[service].ts

// 1. Import SDK
import { ServiceClient } from "service-sdk";

// 2. Initialize with runtime config
const config = useRuntimeConfig();
const client = new ServiceClient({ apiKey: config.service.apiKey });

// 3. Define typed methods
async function doAction(params: ActionParams): Promise<ActionResult> {
  try {
    return await client.action(params);
  } catch (error) {
    throw createError({ statusCode: 500, message: error.message });
  }
}

// 4. Export as use*()
export function useService() {
  return {
    doAction,
    client,  // Expose for advanced usage
  };
}
```

## Key Gotchas

1. **Config at module level** - `useRuntimeConfig()` works at module scope
2. **Singleton clients** - Initialize once, reuse across requests
3. **Composition order** - Call use*() inside functions, not module level
4. **Error transformation** - Convert SDK errors to HTTP errors
5. **Transaction scope** - Pass `trx` when in transaction
6. **Failure is not absence** - Only a not-found means "none"; see Failures from third-party calls
7. **Every outbound call gets a timeout** - On the call itself, not a `Promise.race`
