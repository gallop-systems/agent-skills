# Idempotent seeding pattern

How to seed a preview/dev database so it stays useful as the app grows — without
the seeds drifting out of sync with the schema. This is a *convention*, not a
Kysely feature; it layers on top of `kysely seed make` / `kysely seed run`.

Not every project has (or needs) a seed system. Reach for this when there's a
preview or dev box that a human logs into to *see* the app — a seedless box shows
empty screens, so every new feature has to be seeded to be visible there. A
library or a pure-API service with no such box doesn't need any of this.

## What seeds are for (and what they are not)

- **Migrations** define the schema. **Tests** assert behavior and roll back.
  **Seeds** populate a *live* preview/dev DB with the minimum data needed to log
  in and exercise the features — and they *commit*.
- A seed's job is to make a feature **visible and reachable** in the preview, not
  to test it. Seed one row per state worth seeing, not exhaustive permutations.

## The core idea: factories shared by tests AND seeds

Put the row-level builders in one framework-agnostic module (e.g.
`db/factories.ts`) that both the test suite and the seeds import. Each builder
inserts a single row with sensible defaults plus the FK ids the caller threads
in.

```ts
// Accepts either a live connection (seeds) or a test transaction (tests).
export type DbLike = Kysely<DB> | Transaction<DB>;

export function createFactories(db: DbLike) {
  return {
    async user(data: Partial<{ email: string; name: string }> = {}) {
      const n = nextSeq();
      return db.insertInto("users")
        .values({ email: data.email ?? `user${n}@example.com`, name: data.name ?? "User" })
        .returningAll().executeTakeFirstOrThrow();
    },
    // ...one builder per table you seed
  };
}
```

- **Tests** call `createFactories(trx)` with a per-test transaction (rolled back).
- **Seeds** call `createFactories(db)` with the live connection (committed).
- A scene that reads well in a seed reads well in a test, and vice versa — one
  source of truth for "a valid row of X".

**DO** keep this module free of any test-framework import. Seeds load it at
runtime under the bare `seed run` context (no test runner, no app DI / framework
auto-imports), so a stray `import { test } from "vitest"` breaks `seed run`.

## Uniqueness: a monotonic counter, not randomness

Drive unique fields off a process-global counter, not random suffixes.

```ts
let seq = 0;
const nextSeq = () => ++seq;   // user1@…, user2@…, never collides
```

- **DO** use `nextSeq()` for every "just needs to be unique" value.
- **DON'T** use `Math.random()` / timestamps for uniqueness — they birthday-collide
  eventually and make failures non-reproducible.

## Idempotent + order-independent — the hard contract

Seed runners (e.g. kysely-ctl) execute every file in directory-read order with
**no ledger** and re-run on every preview deploy. So:

- **Order-independent** — a seed must NOT depend on another seed having run
  first. Each file builds the world it needs from factories.
- **Idempotent** — running the full set twice must not throw and must not
  duplicate. For most rows, `nextSeq()` already guarantees no collision. For a
  row that must be **stable and addressable across re-seeds** (the canonical
  example: the anchor login user the preview logs in as), upsert on a natural
  key instead:

```ts
await db.insertInto("users").values(anchor)
  .onConflict((oc) => oc.column("email").doUpdateSet(anchor))
  .execute();
```

- **DON'T** hardcode a unique literal in a plain `insertInto` — the second run
  throws on the unique constraint.
- **DON'T** reach across files for an id; if two scenes truly share an entity,
  give each its own copy or upsert a shared anchor both can look up by key.

## Build scenes directly in their target state

When an entity has a lifecycle (draft → sent → accepted), create each seed row
*directly* in the state you want to see by writing the same stored columns the
real transition writes (status + last-action + timestamps), rather than inserting
a draft and calling the app's transition code.

- **DO** set the columns directly. Seeds run in a bare context and should compose
  only factories + plain inserts.
- **DON'T** import the app's service/transition utilities into a seed — they
  often rely on framework auto-imports or request context that doesn't exist
  under `seed run`. (Guard the "directly-built state is actually reachable/
  consistent" claim with a test instead.)

## The validity harness — what keeps seeds from rotting

Typecheck + codegen catch *shape* drift (a seed referencing a renamed column).
They do **not** catch runtime breakage. Add one test — the validity harness —
that, against a freshly-migrated schema:

1. Runs **every** seed file (auto-discovered, so a new broken seed is caught for
   free), inside a rolled-back transaction so the shared test DB stays clean.
2. Runs the full set **twice** and asserts no throw — proving idempotency.

This catches the two failure modes typecheck can't:

- **Constraint drift** — a migration adds a NOT NULL column with no default, a
  new CHECK, or a new UNIQUE, and every seed inserting that table now throws at
  runtime while still typechecking.
- **Non-idempotency** — a hardcoded unique value or an unhandled conflict that
  only surfaces on the second run.

**DO** discover seed files dynamically (glob / import-all) so the harness covers
new seeds automatically. **DON'T** maintain a hand-listed array of seeds to test
— it silently misses the next one added.

## Preview login, briefly

A preview box often serves on a dynamic URL that can't be a fixed OAuth redirect,
so it logs in via a dev-only backdoor as the seeded anchor user. Keep the anchor
user definition in **one** module that both the seed and the login route import,
and gate the backdoor on **both** a compile-time dev check (dead in prod builds)
**and** a runtime flag — so it can't ship enabled. The anchor user is the
upsert-on-natural-key row from the idempotency section.

## Checklist

- [ ] Factories module is test-framework-free and shared by tests + seeds.
- [ ] Unique values come from a counter, not randomness.
- [ ] Each seed is self-sufficient (no cross-file ordering dependency).
- [ ] Stable/addressable rows upsert on a natural key; everything else rides the counter.
- [ ] Lifecycle rows are built directly in their target state, no app-util imports.
- [ ] A validity harness runs every seed twice against the latest migration.
- [ ] The preview anchor user lives in one module, gated dev-only + runtime-flagged.
