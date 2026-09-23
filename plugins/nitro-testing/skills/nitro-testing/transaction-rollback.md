# Transaction Rollback Pattern

> **Example:** [test-utils-index.ts](./examples/test-utils-index.ts)

The core isolation pattern: each test runs inside a database transaction that auto-rolls back.

## Why This Pattern?

| Approach | Speed | Isolation | Real SQL |
|----------|-------|-----------|----------|
| Truncate tables | Slow | ✅ | ✅ |
| Mock database | Fast | ✅ | ❌ |
| **Transaction rollback** | **Fast** | **✅** | **✅** |

Transaction rollback gives you real SQL testing with mock-like speed.

## Implementation

### Custom Vitest Fixture

```typescript
import { vi, test as base, expect } from "vitest";
import { db } from "../utils/db";
import type { Transaction } from "kysely";
import type { DB } from "../db/db";

// Current test transaction - handlers access via stubbed useDatabase
let currentTrx: Transaction<DB> | null = null;

interface TestFixtures {
  factories: Factories;
  db: Transaction<DB>;
}

export const test = base.extend<TestFixtures>({
  // The factories fixture sets up the transaction
  factories: async ({}, use) => {
    await db.transaction().execute(async (trx) => {
      currentTrx = trx;
      try {
        await use(createFactories(trx));
        // Force rollback by throwing
        throw { __rollback: true };
      } finally {
        currentTrx = null;
      }
    }).catch((e) => {
      // Swallow our rollback signal
      if (e && typeof e === "object" && "__rollback" in e) {
        return;
      }
      throw e;
    });
  },

  // The db fixture exposes the transaction for direct queries
  db: async ({ factories: _ }, use) => {
    if (!currentTrx) {
      throw new Error("db fixture used outside transaction context");
    }
    await use(currentTrx);
  },
});

export { describe, expect, beforeAll } from "vitest";
```

### Stubbing useDatabase

```typescript
// In setup.ts or as part of setupHandlerMocks()
vi.stubGlobal("useDatabase", () => {
  if (!currentTrx) {
    throw new Error("useDatabase called outside of test transaction");
  }
  return currentTrx;
});
```

Now any handler code that calls `useDatabase()` gets the test transaction.

## Handling Nested Transactions

Real code often uses `db.transaction()` for atomic operations. Since tests already run in a transaction, we need to handle nested transactions:

```typescript
// Patch Transaction prototype to handle nesting
const KyselyModule = await import("kysely");
const TransactionClass = (KyselyModule as any).Transaction;

if (TransactionClass?.prototype) {
  TransactionClass.prototype.transaction = function () {
    const self = this;
    return {
      execute: async <T>(callback: (trx: any) => Promise<T>): Promise<T> => {
        // Just run callback with same transaction (no nesting)
        return callback(self);
      },
    };
  };
}
```

This makes code like this work transparently:

```typescript
// In production: creates real nested transaction
// In tests: reuses the test transaction
async function createOrder(data: OrderData) {
  return db.transaction().execute(async (trx) => {
    const order = await trx.insertInto("order").values(data)...;
    await trx.insertInto("order_item").values(...)...;
    return order;
  });
}
```

## Usage Pattern

```typescript
import { describe, test, expect, mockPost } from "~/server/test-utils";
import handler from "./index.post";

describe("POST /api/orders", () => {
  test("creates order with items", async ({ factories, db }) => {
    // Create test data using factories (transaction-bound)
    const user = await factories.user();
    const product = await factories.product({ price: 100 });

    // Test the handler
    const event = mockPost({}, {
      userId: user.id,
      items: [{ productId: product.id, quantity: 2 }],
    });
    const result = await handler(event);

    // Verify in database
    const order = await db
      .selectFrom("order")
      .where("id", "=", result.id)
      .selectAll()
      .executeTakeFirst();

    expect(order?.total).toBe(200);

    // Verify order items
    const items = await db
      .selectFrom("order_item")
      .where("order_id", "=", result.id)
      .selectAll()
      .execute();

    expect(items).toHaveLength(1);
  });
  // Transaction rolls back - database unchanged
});
```

## Key Points

1. **Always destructure `factories`** - Even if unused, it triggers transaction setup
2. **Use `db` fixture for assertions** - Not the real db import
3. **Nested transactions work** - Thanks to prototype patching
4. **No cleanup needed** - Rollback happens automatically
5. **Tests can't see each other's rows** - But parallel workers sharing one database *can* block each other (see below)

## Gotcha: Unused Factories

Even if you don't create test data, you need the fixture to set up the transaction:

```typescript
// ❌ Wrong - no transaction, useDatabase will fail
test("returns empty list", async () => {
  const result = await handler(mockGet({}));
  expect(result).toEqual([]);
});

// ✅ Right - transaction set up via factories fixture
test("returns empty list", async ({ factories: _ }) => {
  const result = await handler(mockGet({}));
  expect(result).toEqual([]);
});
```

## Gotcha: Parallel Workers Sharing One Database Deadlock

Rollback hides rows, not locks. Vitest runs test files in parallel workers, and every test
holds its transaction open until it rolls back. If all workers share one test database:

- Inserting a unique value that another **uncommitted** transaction already inserted *waits*
  for that transaction to finish. Two waits in opposite directions are a deadlock
  (`deadlock detected`), which shows up as a rare, unreproducible test failure.
- Collisions are more common than they look. A module-level factory counter (`let seq = 0`)
  restarts in every test file, so parallel files all insert `code_1` or `test1@example.com`.
  Tests that insert seed-owned codes or reuse literal emails collide the same way.
- Long-held advisory locks (e.g. a seed lock taken for a whole test) queue everyone else.
- DDL in a test (`CREATE TRIGGER`, `ALTER TABLE`) takes a table lock that blocks every other
  transaction touching that table.

Reordering individual inserts or randomizing values only thins the collisions. The fix that
removes them is **one database per worker**: global setup migrates the base test database
once, and each worker clones it (as a template) before its first file.

```typescript
// setup.ts (runs per test file, in the worker)
import { inject } from "vitest";
import { Pool } from "pg";

const base = (process.env.DATABASE_URL_TEST_BASE ??= process.env.DATABASE_URL_TEST!);
const url = new URL(base);
const baseName = url.pathname.slice(1);
const name = `${baseName}__w${process.env.VITEST_POOL_ID ?? 1}`;
const runId = inject("testDbRunId"); // provided once per run by globalSetup (randomUUID())

// CREATE DATABASE ... TEMPLATE refuses while anyone is connected to the template,
// so connect to the maintenance database, not the test database.
const admin = new Pool({ connectionString: base.replace(`/${baseName}`, "/postgres"), max: 1 });
const { rows } = await admin.query(
  "select shobj_description(oid, 'pg_database') as run from pg_database where datname = $1",
  [name],
);
if (rows[0]?.run !== runId) {
  // First file of this run in this worker: replace any clone from an earlier run.
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${baseName}" STRATEGY FILE_COPY`);
  await admin.query(`COMMENT ON DATABASE "${name}" IS '${runId}'`);
}
await admin.end();

url.pathname = `/${name}`;
process.env.DATABASE_URL_TEST = url.toString(); // everything below connects here
```

```typescript
// global-setup.ts
export async function setup(project) {
  // ...reset + migrate the base test database as before...
  project.provide("testDbRunId", randomUUID());
  // teardown: drop every `<base>__w*` database
  return () => dropWorkerDatabases(baseUrl);
}
```

- A worker runs one test at a time, so no two open test transactions share a database.
  Parallelism is unchanged.
- Only the workers a run uses create a clone. `STRATEGY FILE_COPY` (Postgres 15+) keeps
  cloning fast. In practice this cost about 1s per run and took lock waits over 20ms from
  ~1,500 per 20 runs to 0.
- The test role needs `CREATEDB` (`ALTER ROLE <user> CREATEDB`). CI's superuser already has it.
- Each clone's identity sequences start fresh. A test that compared ids across tables without
  checking their type can start failing; that's a latent bug the shared database hid.
- Diagnose before fixing: set `log_lock_waits = on` and `deadlock_timeout = '20ms'` for the
  test server, run the suite a few times, and read which statements waited on which.
