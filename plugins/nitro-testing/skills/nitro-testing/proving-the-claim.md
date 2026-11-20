# Writing Tests That Prove Their Claim

The most common review finding on test files is not a broken test. It is a green test
that would **stay green if the code were wrong**: the name promises one behaviour and the
body never checks it. Each section below is one way that happens, with the rule that
prevents it. Run the [self-check](#self-check-before-you-finish) on every test you write.

## 1. The fixture cannot tell right from wrong

**Trap:** the data makes the broken implementation produce the correct answer. A sort test
whose rows are already in order passes with no sort. A filter test where every row matches
passes with no filter. A "returns a live view" test passes for a copy if nothing changes.

**Rule:** design the fixture so the wrong implementation gives a different answer. Insert
the row the filter must exclude, insert rows in an order the sort must change, and mutate the
source after reading when the claim is "view, not copy". Fixtures must also match the real
input's shape (an already-normalised value, a masked string) or the test runs a path
production never sees. A stubbed lookup that answers for any input cannot produce the
"not found" case the test is about.

```typescript
// ❌ Passes without the filter: every project belongs to the requested owner
test("lists only the owner's projects", async ({ factories }) => {
  const owner = await factories.user();
  await factories.project({ ownerId: owner.id });
  const result = await handler(mockGet({ ownerId: owner.id }));
  expect(result).toHaveLength(1);
});

// ✅ A project that must be filtered out, and identities, not just a count
test("lists only the owner's projects", async ({ factories }) => {
  const owner = await factories.user();
  const mine = await factories.project({ ownerId: owner.id });
  await factories.project(); // another owner: must not appear
  const result = await handler(mockGet({ ownerId: owner.id }));
  expect(result.map((p) => p.id)).toEqual([mine.id]);
});

// ✅ Sort: insert in the reverse of the expected order
const b = await factories.task({ name: "B", dueOn: "2025-03-02" });
const a = await factories.task({ name: "A", dueOn: "2025-03-01" });
expect((await handler(mockGet({}))).map((t) => t.id)).toEqual([a.id, b.id]);
```

## 2. The test never reaches the branch it names

**Trap:** "pads short rows" builds only full rows; "falls back to the query when the cache
misses" tests only the pure builder; "persists on update" calls the create path; a stub
returns early so the code under test never runs and the assertions inside a callback never
execute.

**Rule:** build the exact input the name describes and call the exact entry point. Drive a
component through its real model (`v-model` / emitted events), not by setting internal
state. When assertions live in a callback or a loop that might run zero times, pin the count:

```typescript
test("notifies each assignee", async ({ factories }) => {
  expect.assertions(3); // fails unless the callback ran exactly twice
  const [u1, u2] = [await factories.user(), await factories.user()];
  const task = await factories.task({ assigneeIds: [u1.id, u2.id] });
  const notified: number[] = [];
  await notifyAssignees(task.id, (msg) => {
    expect(msg.taskId).toBe(task.id);
    notified.push(msg.userId);
  });
  expect(notified.sort()).toEqual([u1.id, u2.id].sort()); // each assignee, not one twice
});
```

`expect.hasAssertions()` is the weaker form (at least one).

## 3. The assertion is narrower than the name

**Trap:** the title says "totals every column", the body checks two; the case names three
controls, the body checks one; "keeps the count" asserts the card renders but not the
number; "shows a separate Retry button" asserts the old button is gone, not that the new one
exists; "signs in as the user" asserts `ok: true` but not *which* user.

**Rule:** every noun in the test name maps to an assertion. Assert concrete values (the
number, the id, the visible error text), **presence and absence** both, and the identity
fields in anything auth-related. If the body cannot cover the name, split the test or rename
it. A whole-object `toEqual` / `toMatchObject` is often the cheapest way to cover "every
field".

```typescript
// ❌ Passes if the button is missing entirely
expect(wrapper.find("[data-test=submit]").exists()).toBe(false);

// ✅ The claim is "replaced by Retry": both halves
expect(wrapper.find("[data-test=submit]").exists()).toBe(false);
expect(wrapper.get("[data-test=retry]").text()).toBe("Retry");
```

## 4. The assertion passes for the wrong reason

**Trap:** `rejects.toThrow()` passes for a crash, a typo, or a 500; a broad selector matches
a stray element; the test asserts on the object it built *before* the action, so a handler
that never wrote anything still passes.

**Rule:**
- In rejection tests, assert the status (and message where it is the contract):
  `await expectHttpError(handler(event), { statusCode: 400 })`. In a loop over bad inputs,
  every iteration asserts the status.
- Select by the exact attribute the claim concerns and assert the **count**
  (`findAll(...)` then `toHaveLength(n)`), not "some element matched".
- After a write, **re-read from the `db` fixture**. Status codes and return values are not
  persisted state.

```typescript
// ❌ `task` is the pre-action object: this can never fail
await handler(mockPatch({ id: task.id }, { status: "done" }));
expect(task.status).toBeDefined();

// ✅ Re-read what the handler persisted
const saved = await db.selectFrom("task").where("id", "=", task.id)
  .select("status").executeTakeFirstOrThrow();
expect(saved.status).toBe("done");
```

PostgreSQL trap of the same kind: `has_table_privilege(role, table, 'SELECT, INSERT')` is
true if **any** listed privilege is held. Check each required privilege separately.

## 5. The fake ignores what it is given

**Trap:** a fake HTTP API that answers without looking at the `authorization` header; a
mocked query layer that returns the same rows whatever the filter; a mock router that sends
an outer query to the subquery's fixture; a stub child component that renders no element, so
selector assertions never match anything.

**Rule:** a fake must **reject** the input the real thing would reject, or the test must
assert what the fake received (`expect(fetchMock).toHaveBeenCalledWith(...)`, the bound
query parameters). Route mock fixtures by the outer/most specific match first. Stubs that
the test queries must render a real element (see frontend gotcha
[Reading or driving a stubbed child](./frontend-testing.md#7-reading-or-driving-a-stubbed-child-needs-an-explicit-stub)).
Prefer the real database over a mocked query layer: that is what the harness is for.

## 6. Several expected failures in one transaction

**Trap:** the test asserts "INSERT is refused, UPDATE is refused, DELETE is refused" in one
body. In PostgreSQL, the first error aborts the transaction; every later statement fails with
`current transaction is aborted, commands ignored until end of transaction block` (SQLSTATE
`25P02`). The later checks "pass" for that reason, not for the reason claimed. In this
harness the whole test is one transaction, and nested `db.transaction()` calls reuse it (see
[transaction-rollback.md](./transaction-rollback.md#handling-nested-transactions)), so they
do not isolate anything either.

**Rule:** one expected database failure per test, so each gets its own transaction.
`test.for` keeps it short and, unlike `test.each`, passes the test context (and so the
fixtures) as its second argument:

```typescript
test.for([
  ["a negative quantity", { quantity: -1 }, "23514"], // check_violation
  ["a missing product", { productId: null }, "23502"], // not_null_violation
] as const)("refuses %s", async ([, override, code], { factories }) => {
  await expect(factories.orderItem(override)).rejects.toMatchObject({ code });
});
```

Assert the SQLSTATE `code` (or the constraint name), not just "it threw" (section 4).

## 7. Other rows, other tests, other mounts

**Trap:** a "returns the newest" test with `limit 1` that a seeded or earlier row in the same
transaction can win; an audit assertion that matches a row written by setup, not by the
action; teleported dialog content (or an `attachTo: document.body` mount) from one test still
in `document.body` when the next test queries it.

**Rule:**
- Scope every query in an assertion to the records this test created (by id, or by a
  parent id the test owns). Do not assume the table is empty: seeds and setup rows exist.
  When the query has a time window, make the fixture sit clearly inside or outside it.
- Unmount in `afterEach`, so a failing assertion cannot leak nodes into later tests, and
  query teleported content through a scoped root, not the whole `document.body`:

```typescript
let wrapper: VueWrapper | undefined; // from @vue/test-utils
afterEach(() => wrapper?.unmount());

it("opens the filter panel", async () => {
  wrapper = await mountSuspended(ProjectFilters);
  // ...
});
```

## 8. Time and concurrency

**Trap:** hard-coded "future" dates that become past dates next year; a lock test that
"proves" a wait by checking the second query is still pending after 200 ms, which passes on a
slow host without any lock.

**Rule:** pin the clock for anything that compares with today. Fake only `Date` in tests that
touch the database, so driver timeouts keep working:

```typescript
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2025-06-15T12:00:00Z") });
});
afterEach(() => vi.useRealTimers());
```

The JS clock does not move PostgreSQL: `now()` comes from the server and, inside this
harness, is fixed at the start of the test's transaction. When SQL compares with `now()`,
build fixture dates relative to it, or pass the date in as a parameter.

For waits and locks, observe the state directly (from another connection, the blocked
backend shows `wait_event_type = 'Lock'` in `pg_stat_activity`) instead of inferring it
from a timeout.

## 9. The test never runs, or never compiles

**Trap:** a new test file that no declared test command includes, or that reads an env var
the command does not set, so CI skips it silently; a module-level `db` connection that fails
(or forces the env var) when the suite is meant to be skipped; fixtures that pass a value
the factory's type union no longer allows, or a column a migration dropped.

**Rule:** check that the file matches an `include` glob of a command CI runs, with the env
var that command sets. Open connections in `beforeAll`, not at module top level (top-level
code runs when the file is collected, even if every test is skipped). Run `typecheck` on test
files, and update tests in the same change as the migration or type they depend on.

Test helpers that catch errors (cleanup, an expected exit code) must catch only the expected
one and rethrow the rest, and clean up in `finally` when the state lives outside the test
transaction.

## Self-check before you finish

For each test, answer these. A "no" means the test does not yet prove its name.

1. **Would it fail if I deleted the line under test** (the filter, the sort, the write, the
   permission check)? If you are unsure, revert it and run the test once.
2. Does the fixture contain the case that the wrong implementation gets wrong (the excluded
   row, the out-of-order row, the missing row)?
3. Does every noun in the test name have an assertion, including both presence and absence?
4. After a write, did I re-read the database rather than trust the response or the
   pre-action object?
5. Do rejection tests assert the status or error code, and does each expected database
   failure have its own test?
6. Can another row, test, or mount satisfy the assertion? Is it time- or speed-dependent?
7. Does a command CI actually runs include this file, and does it typecheck?
