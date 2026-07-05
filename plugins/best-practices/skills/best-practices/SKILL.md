---
name: best-practices
description: Apply accumulated code-review feedback and coding best practices so past mistakes aren't repeated. Consult before writing or editing code, and re-check before finalizing. Trigger proactively at the start of any coding task (new feature, bug fix, refactor, scaffolding) and re-consult before handing back changes.
---

# Best Practices

A living checklist of code-review feedback distilled into rules. The goal: never repeat the same mistake twice. Use it as a safety net that catches recurring issues before they reach review.

## How to use this skill

1. **At the start of a coding task** — read the rules below and keep them in mind while writing code.
2. **Before declaring a task complete** — re-read the rules and self-audit the diff against each one. If any rule is violated, fix it before handing back.
3. **When you receive new review feedback** — add a new rule under the appropriate section (or create a new section). Each rule should include:
   - **Rule:** the do/don't, stated crisply.
   - **Why:** the reason (often a specific past incident or principle).
   - **How to apply:** when/where this kicks in during coding.

Keep rules concrete and actionable. Vague rules ("write clean code") are useless — specific rules ("don't add try/catch around DB calls in API handlers; let Nitro handle the error") prevent repeat mistakes.

## Rules

<!-- Add new rules below as you receive code-review feedback. Group by topic. -->

### General

#### Invoke the `carry-plan` skill for ambitious, multi-chat features

- **Rule:** Before starting (or resuming) work on a feature that's clearly bigger than one chat — a new subsystem, a multi-file backend + frontend + migration change, a multi-week initiative, or anything referred back to by name across sessions — invoke the `carry-plan` skill. Same for any of these phrases: "carry this across chats", "keep a plan for this", "pick up where we left off on X", "finalize the plan for the PR". Do **not** invoke it for one-shot work (single bug fix, small refactor, one-component change) — the planning overhead isn't worth it.
- **Why:** Implementation details written into chat scrollback evaporate when the next chat starts. `carry-plan` keeps a plain-language `docs/<slug>.md` that travels across sessions and only gets committed (rewritten as "what was done") in the final PR. Skipping it on ambitious work means the next session re-derives decisions from the code and often gets them wrong.
- **How to apply:** At the start of any coding task, classify: is this likely to finish in one chat? If no — invoke `carry-plan` before the first edit. If a `docs/<slug>.md` already exists for the feature, load it as ground truth before doing anything else. When in doubt (task scope unclear), ask rather than guessing.

#### Use the project's blessed typecheck command — never fall back to `vue-tsc` or `nuxi typecheck` directly

- **Rule:** For TypeScript type-checking in a Nuxt repo, run the project's blessed script (e.g. `yarn typecheck`). That is the only command. Do **not** invoke `npx vue-tsc` (with or without `--noEmit`), `npx nuxi typecheck`, or any other ad-hoc typecheck command. If the blessed script fails to run (script missing, errors before checking, environment issue), **stop and surface it** — don't reach for a substitute.
- **Why:** The project's typecheck script is the blessed entry point — it wires up the Nuxt environment (generated types, auto-imports, `#imports`, the real tsconfig) the way the repo expects. Substituting raw `vue-tsc` produces noisy false positives (unresolved auto-imports, missing module errors) and can miss real errors. Substituting `nuxi typecheck` skips any extra flags or pre-steps the blessed script may include. Either substitution gives a misleading answer that wastes time. If the script is broken, that's worth surfacing, not papering over.
- **How to apply:** Whenever you want to verify types, run the project's typecheck script — nothing else. If it doesn't work, surface the failure and wait for direction. Never silently swap in `vue-tsc` or `nuxi typecheck`.

#### Invoke the `database` skill before any direct DB access

- **Rule:** Before running `psql` (or any other direct database client) to inspect, query, or count data, invoke the `database` skill. Triggers include questions like "does my db have X", "what's in the database", "check the db for Y", or any moment you're about to type `psql` into Bash.
- **Why:** The shell the agent runs in does not inherit the project's `.env`, so `$NUXT_DATABASE_URL` is often unset and `psql "$NUXT_DATABASE_URL"` silently connects to a default DB. That produces misleading "relation does not exist" errors and wrong-answer conclusions about what the app's DB contains.
- **How to apply:** When a DB lookup is needed, invoke `database` first and follow its `.env`-reading procedure to get the correct connection string before running any `psql` command.

### Frontend (Vue / Nuxt / Volt)

#### Don't pass type generics to `useFetch` / `$fetch` for internal API routes

- **Rule:** Never write `useFetch<{ items: Foo[] }>("/api/...")` or similar. Call it untyped: `useFetch("/api/estimates")`. Same for `$fetch`, `useAsyncData`, etc. against internal `/api/*` routes. Also delete any local interface/type alias whose only purpose was to feed that generic.
- **Why:** Nuxt automatically infers the response type from the API route's handler return type. An explicit generic *overrides* inference rather than validating against it — so when the handler changes, the generic silently goes out of sync and masks real type errors.
- **How to apply:** Any time you're calling a fetch helper against an internal `/api/*` route, omit the type parameter. If you find yourself defining an interface that mirrors a server return shape just to pass it as a generic, delete the interface and drop the generic.

#### Derive shared API-shaped types from the handler, never hand-write them

- **Rule:** When multiple components need the same API response shape (e.g. sibling cards/tabs that all receive a row as a prop), do **not** hand-write a TypeScript interface that mirrors the API. Derive it from the Nitro handler via a shared `EndpointResponse<Path>` helper (e.g. at `app/types/api.ts`). List endpoints expose an `items` array — index into it with `[number]`.
- **Why:** A hand-written interface is a second source of truth. It silently drifts from the handler (e.g. claims `status: "draft" | "active" | ...` while the handler actually returns `string`). Combined with `useFetch<FooDetail>`, the lie compounds: the generic asserts the false shape rather than validating against the real one, and downstream components rely on narrowing that doesn't actually hold at runtime. The handler is the only real source of truth.
- **How to apply:** When you find yourself about to write `interface FooDetail { ... }` that mirrors `/api/foo/[id].get.ts`, instead write:
  ```ts
  // app/components/foo/types.ts
  import type { EndpointResponse } from "~/types/api";

  export type FooDetail = EndpointResponse<"/api/foo/:id">;
  export type FooListItem = EndpointResponse<"/api/foos">["items"][number];
  ```
  The helper itself lives at `app/types/api.ts`:
  ```ts
  import type { InternalApi } from "nitropack/types";

  export type EndpointResponse<Path extends keyof InternalApi> =
    InternalApi[Path] extends { get: infer R } ? R : never;
  ```
  Removing a hand-written interface may surface real type mismatches that the false shape was hiding (narrow unions where the API returns `string`, missing fields, etc.). Fix those at the boundary — loosen the local type, cast where the DB CHECK constraint guarantees the value, or update the handler to narrow honestly. Don't put the lie back.

#### Don't define components inline; only extract a component if it'll actually be reused

- **Rule:** Never define a component inline inside another component's `<script setup>` (no `defineComponent` + `h()` mini-components, no inline render functions used as local components). Two paths instead: (1) if the markup is only used in this one file, write it directly in the template — duplication of a few lines is fine; (2) if it's reused across files, extract it to its own `.vue` SFC and import it.
- **Why:** Inline `defineComponent` + `h()` blocks are harder to read than either plain template markup or a real SFC, they bypass `<template>` tooling (no template type-checking, no formatter coverage), and they tend to get copy-pasted between files instead of extracted properly. Seen in the wild: a `Tile` helper duplicated across two card components — the right move was a shared `Tile.vue`, not two inline copies.
- **How to apply:** If you're tempted to write `const Foo = defineComponent({ ... })` or `h(...)` inside `<script setup>`, stop. Decide: is this used elsewhere? If no, inline the markup in the template. If yes (or about to be), create a sibling `.vue` SFC and import it. Don't preemptively extract single-use markup into a component "just in case."

#### Prefer `ref` over `reactive` unless `reactive` is actually needed

- **Rule:** Default to `ref()` for component state, including objects. Only reach for `reactive()` if there's a concrete reason it's required. In templates, refs auto-unwrap, so `form.foo` works the same way; in script, use `form.value.foo`.
- **Why:** Two reasons. (1) Consistency — mixing `ref` and `reactive` in the same codebase forces readers to track which is which. (2) `ref` lets you replace the whole object in one assignment (`form.value = { ... }`), whereas `reactive` requires per-property mutation to preserve the proxy. There's rarely a good reason to choose `reactive` over `ref` for typical form/state objects.
- **How to apply:** When introducing reactive state, write `const form = ref({ ... })`. If you find yourself reaching for `reactive`, pause and confirm there's a real reason (e.g. a library that requires a plain reactive proxy). Otherwise use `ref`.

#### Format dates with `date-fns` via the `useFormatters` composable — never hand-roll

- **Rule:** Any time you need to format a date (or parse an ISO string) in frontend code, use `date-fns` via a shared `useFormatters()` composable (e.g. `app/composables/useFormatters.ts`). Do **not** hand-roll formatters with `split("-")`, `slice()`, manual `toLocaleDateString`, or ad-hoc string concatenation. If `useFormatters` doesn't yet expose the format you need (e.g. `formatShortDate`, a different pattern), **add a function to `useFormatters` first**, then call it — don't write a local one-off helper in the page/component.
- **Why:** Two reasons. (1) Hand-rolled date code is a known source of timezone bugs — naïve `new Date("2025-01-28")` parses as UTC midnight and shifts a day in negative TZ offsets, which is why `useFormatters` should use `parseISO` from date-fns. (2) Centralizing date formatting in one composable means consistent output across the app (one place to change the format, one place to fix a bug, no parallel divergent helpers). Seen in review: a local `shortDate(iso)` that split on `-` and built `MM/DD/YY` by hand; reviewer pushed back to use date-fns in a shared util.
- **How to apply:** When you need a formatted date, first check what `useFormatters` already exposes (`formatDate`, `formatTime`, `formatShortDate`, etc.). If your format exists, use it. If not, add a new function to `useFormatters.ts` (using `parseISO` + `format` from date-fns), export it from the composable's return, then call it from the page. Never define a local `function shortDate(...)` or similar in a Vue file.

#### Format currency through the `useFormatters` composable — never hand-roll a local `usd()`

- **Rule:** Any time you need to format a number as USD in frontend code, use `formatCurrency` from the `useFormatters()` composable. Do **not** define a local `function usd(n)` (or similar) in a page/component that calls `n.toLocaleString("en-US", { style: "currency", ... })` directly. If `formatCurrency` doesn't yet expose the variant you need (e.g. compact display that drops cents above $1000), **add an option to `formatCurrency` first**, then call it — don't write a parallel helper.
- **Why:** Same rationale as dates: one place to change the format, one place to fix a bug, no parallel divergent helpers. Seen in review: two separate pages each defined an identical local `usd(n)` with the same `maximumFractionDigits: n >= 1000 ? 0 : 2` rule; reviewer flagged both and asked for a single shared util. Fix was extending `formatCurrency` with a `compact` option and dropping both locals.
- **How to apply:** When you need a formatted currency value, first check what `formatCurrency` already accepts. If your variant exists, use it (`formatCurrency(amount)` or `formatCurrency(amount, { compact: true })`). If not, add an option to `formatCurrency` in `useFormatters.ts`, then call it from the page. Never define a local `function usd(...)` or copy a `toLocaleString({ style: "currency" })` block into a Vue file.

#### Lookup tables (status → class, type → icon, etc.) are objects keyed by the input — not switch statements

- **Rule:** When a function's only purpose is to map one of N enum-like input values to one of N output strings (a status to a Tailwind class, a type to an icon name, a kind to a label), write it as a plain object keyed by the input value, not as a `switch` or `if/else` chain. Use `Partial<Record<UnionType, T>>` when not every union member has a mapping, and provide a fallback at the call site (`map[key] ?? fallback`).
- **Why:** An object lookup is shorter, has no branching, makes the full mapping visible at a glance (one entry per row), and is trivially extensible — adding a new status is one new key, not a new `case`. A switch on a small enum-to-string mapping is ceremony with no benefit. Seen in review: a `statusPillClass(s)` 4-case switch returning class strings; converted to `const statusPillClass: Partial<Record<Foo["status"], string>> = { active: "...", costing: "...", expired: "..." }` with a fallback at the call site.
- **How to apply:** Before writing `function fooClass(x: X) { switch (x) { case "a": return "..."; ... } }`, stop and ask: is every branch just `return <string>`? If yes, write `const fooClass: Partial<Record<X, string>> = { a: "...", b: "..." }` and use `fooClass[x] ?? "default"` at the call site. Reserve `switch` for branches that actually do different work (computing values, calling different functions, multi-line logic). If the template binds the value (`row.status`) and TypeScript can't narrow it to the union, cast at the indexing site (`map[row.status as X]`) — that's fine for a small lookup.

#### Multi-child pages share data via parent-owned `useFetch` + child emits, or a shared composable — not `watch(activeTab)`

- **Rule:** For pages with multiple child views (tabs, panels, sibling cards) that share or derive from the same data, pick one of two shapes:
  - **(a) Parent owns the data.** Parent does the `useFetch` calls, passes data down as props, children emit events on every write that could affect another child's view, parent listens and calls the relevant `refresh()`.
  - **(b) Shared composable.** Wrap all data fetching + mutation operations in a single composable that every child imports and uses directly. The composable owns the refs and the refresh logic.
  Do **not** add a `watch(activeTab)` in the parent that refreshes everything when a tab activates — that's a workaround for missing emits, not a design.
- **Why:** Both (a) and (b) keep a single source of truth and make data dependencies explicit. `watch(activeTab)` papers over which writes actually need notification, creates a mount-with-stale-props flash, and re-fetches data the user never asked to refresh. Seen in review: an initial pass added `watch(active)` calling all `refresh*`s for the destination tab; reviewer pushed back that the correct shape is either parent-owns-data + child-emits-on-write, or a shared composable. Reworked to (a) — added `types-changed` / `openings-changed` / `options-changed` emits from each tab and wired them in the parent.
- **How to apply:** Pick (a) when each child already has substantial local state (drafts, optimistic toggles, flash animations) that would be expensive to hoist — keep the children as-is and add emits on every POST/PUT/DELETE success path; parent wires events to matching `refresh*` from `useFetch`. Pick (b) when the children are thin and the data ops are non-trivial enough to deserve a unified surface (fetch + mutate + invalidate in one place). If you catch yourself writing `watch(activeTab, ...)` to backfill missing emits, stop — add the emit or move to a composable instead.

### Backend (Nitro / Kysely / Postgres)

#### Reuse or extend existing endpoints — don't add a new endpoint when an existing one already serves the same surface

- **Rule:** Before creating a new API endpoint, check whether an existing endpoint already covers the same UI surface, entity, or fetch trigger. If yes, **extend** that endpoint's response shape instead of adding a sibling endpoint. Only create a new endpoint when the data has a genuinely different audience, lifecycle, or caching profile from anything that already exists.
- **Why:** Two endpoints fetched by the same component means two round-trips, two `useFetch` calls, two test files, two mock registrations, and two places to keep in sync. Conceptually-paired data drifts into separate shapes over time. Seen in review: a separate `/api/tasks/[id]/redo-context` endpoint was the first instinct, but the only consumer was the same panel that already calls `/api/tasks/[id]/external-approvals` — folding `redoContext` into that response collapsed both fetches into one and removed an entire endpoint + test file.
- **How to apply:** When you find yourself about to create a new GET endpoint, ask: which component will fetch this, and what else does that component already fetch? If the answer is "the same endpoint family that's already feeding this view," widen the existing response (e.g. `Request[]` → `{ requests, redoContext }`) instead of adding a new route. Update the existing handler's tests and the component's destructure together. Adding a new endpoint is the right call when the data is fetched on a different page, has a different cache lifecycle, or is genuinely a separate concern — not when it's just "more context for the panel that's already loading."

#### Don't give a new table a generic name that collides with a well-known concept in a different domain

- **Rule:** When introducing a new database table, do not use a name that a typical reader would assume means something else. Universally-overloaded words like `role` (auth/permission), `user` (the people table), `event` (audit log), `session`, `permission` are off-limits when the new table is about a different concept. Pick a name specific enough that a reader who only sees the schema can tell what kind of row lives in the table.
- **Why:** A misleading name pays interest forever — every grep, every code-review pass, every join, every onboarding read of the schema. A reader who sees `role` will assume auth roles and read the surrounding code through that lens; you'll be correcting that assumption in every PR review for years. The cost of a slightly longer, more specific name at creation time is trivial compared to the lifetime cost of the wrong one. Seen in review: an initial migration named the table `role`, which collides with both auth/permission roles and Postgres DB roles, even though the table is actually a catalog of named slots an assignee fills (Architect, Structural Engineer, Reviewer). Renamed to `assignee_designation`.
- **How to apply:** Before finalizing a `createTable(...)` name in a migration, ask: "if a reader saw only this name, would they guess the wrong concept?" If yes, switch to a domain-natural compound noun that describes what one row *is* — e.g. `assignee_designation`, `external_approver`, `automation_run`, `approval_request` — rather than a single overloaded word. Bare single-word names are fine when the word is unambiguous in the codebase (e.g. `job`, `task`, `milestone`), and not fine when it isn't (`role`, `event`, `status`, `position`).

#### Don't prefix a new table with another table's name unless the new table is a real reference / child of it

- **Rule:** Table-name prefixes like `job_*`, `task_*`, `project_*` carry a strong implication that the new table holds rows belonging to a parent in that table (foreign key, owned-by relationship). Do not use a parent-table prefix as a flavor word or theme — only when the new table genuinely references that parent. If the new table is workspace-scoped, template-scoped, or otherwise *not* a child of the prefixed table, drop the prefix and name it for what it actually is.
- **Why:** A name like `job_function` makes every reader assume "rows here belong to a specific job," which shapes how they read joins, indexes, and lifecycle. If the table is actually a workspace-wide catalog, that assumption is wrong everywhere it appears — in migrations, in foreign keys you didn't add but a reader expected to find, in the mental model of every developer touching adjacent code. The prefix lies about the cardinality. Seen in review: `job_role` / `job_function` were proposed for a workspace-scoped table, which would have implied a per-job relationship that doesn't exist. The table is one global row per designation, referenced by many jobs.
- **How to apply:** Before reaching for `job_X`, `task_X`, `project_X`, ask: "is there a `*_id` foreign key from this table to that parent table, and does each row in the new table belong to exactly one parent row?" If no to either, drop the prefix. Name the table for the concept itself (`assignee_designation`, `task_dependency`, `external_approver`) — domain-natural compounds that describe the row, not the relationship. When the table genuinely is a child (e.g. `task_approval` rows that each belong to one task), the prefix is correct and helpful.

#### Nest sub-resource endpoints under their parent to force callers to be aware of the parent context

- **Rule:** When an endpoint operates on a row that conceptually belongs to a parent entity (an evaluation case under a student, a task under a project, an attachment under a job), nest the route under the parent: `/api/students/[studentId]/evaluation_cases/[id]` rather than a flat `/api/evaluation-cases/[id]`. This applies even if the handler itself doesn't need the parent ID to satisfy the query — the path shape exists to make every caller name the parent they're operating in.
- **Why:** A flat endpoint lets callers fetch a sub-resource without knowing or thinking about its parent, which encourages UI and code paths that "have a case ID from somewhere" and pull it out of context. Nesting bakes the parent into the URL so the call site has to surface where the student came from — usually exposing missing routing context, ambiguous navigation, or a place where the parent ID should have been tracked but wasn't. Seen in review: a case detail GET was first added as `/api/evaluation-cases/[id]`; renamed to `/api/students/[studentId]/evaluation_cases/[id]` so every consumer is forced to know whose case they're loading. Handler logic stayed identical — the change is purely about call-site discipline.
- **How to apply:** When adding a GET/PATCH/DELETE handler for a row in a sub-resource table, default to nesting under the parent's path. Use the parent's `[parentId]` param name (e.g. `[studentId]`, `[projectId]`) so it's unambiguous in the URL. The handler does not have to read the parent param — leave the handler logic minimal unless there's a real authorization or scoping reason to validate the pairing. The path shape alone is the point. Exception: top-level resources with no meaningful parent (students themselves, users, projects at the root) stay flat.

#### Soft-delete columns travel in pairs — never a `deactivated_at` without a `deactivated_by`

- **Rule:** When adding a soft-delete / soft-deactivation marker to a table, add the *audit* column alongside the timestamp in the same migration: `deactivated_at timestamptz` **and** `deactivated_by bigint references users.id`. The same goes for any other "X happened" timestamp that should record who did it (`archived_at`/`archived_by`, `cancelled_at`/`cancelled_by`, `approved_at`/`approved_by`). Enforce that they travel together with a table CHECK constraint so the DB makes the invalid state unrepresentable:
  ```ts
  .addColumn("deactivated_at", "timestamptz")
  .addColumn("deactivated_by", "bigint", (col) => col.references("users.id").onDelete("restrict"))
  .addCheckConstraint(
    "clients_deactivated_by_with_at",
    sql`(deactivated_at IS NULL) = (deactivated_by IS NULL)`,
  )
  ```
  Active rows have both `NULL`; deactivated rows have both set. Don't rely on a code comment ("travels with `deactivated_at`") to hold the invariant — a comment is not a constraint. Also remember to index the new FK column (`deactivated_by`), per the FK-indexing rule.
- **Why:** A bare `deactivated_at` records *that* a row was retired but loses *who* retired it — the audit trail is gone exactly when you most need it (disputes, compliance, "who killed this row?"). And without the CHECK, the table can drift into half-states (`deactivated_at` set, `deactivated_by` null, or vice versa) that every query then has to defensively handle. The constraint collapses four possible states to the two valid ones, so readers and queries can trust the pairing. Seen in review: a soft-delete migration added the columns with a comment claiming `deactivated_by` "travels with `deactivated_at`," but nothing enforced it.
- **How to apply:** Any time you reach for a `*_at` column that marks a deliberate human action (deactivate, archive, cancel, approve, lock), add the matching `*_by` FK to `users.id` in the same migration, add a CHECK constraint asserting `(x_at IS NULL) = (x_by IS NULL)`, and index the FK. Pure system timestamps that aren't a human action (`created_at`, `updated_at` maintained by a trigger) don't need a `_by`. When you find an existing table with a lone `deactivated_at` (no `_by`), flag it — it likely predates this rule.

### Testing

#### Seed prerequisite rows via a factory, not via the real POST handler

- **Rule:** If a test needs row X to exist as a *prerequisite* — and the test isn't actually exercising the create-X endpoint — seed X with a `factories.x(...)` direct DB insert. Do not call the real `POST /api/x` handler from setup. The handler should only appear in tests that are testing it. If a factory for the prerequisite doesn't exist yet, add one to `server/test-utils/index.ts` rather than reusing the handler.
- **Why:** Going through the handler in setup couples *every* downstream test to the create contract. When the contract tightens (a new required field, a new validation, a renamed param), every unrelated test breaks at setup and has to be patched. Seen in review: requiring `submission_id` on `POST /api/estimates` broke 7 unrelated test files because their `setup()` helpers called the create handler just to seed an estimate. Fix was adding `factories.estimate(...)` and decoupling.
- **How to apply:** When writing a `setup()` for a test, ask: am I testing the creation of this thing, or do I just need it to exist? If just need it to exist → factory. If a factory for it doesn't exist yet, add one — that's the right level of investment. Reserve handler calls in setup for tests that are *specifically* about the handler's behavior.

### Git / PRs

#### Don't start implementing on the default branch — create a tracker issue and branch off first

- **Rule:** If the current branch is the default branch (e.g. `main`) and you've just been asked to implement a feature, fix, or other deliberate piece of work, do **not** start editing files. First invoke the `linear` skill (or your tracker's skill) to create an issue for the work, then create a branch named per the tracker's suggested convention (e.g. `<user>/<LINEAR-ID>-<descriptive-slug>`), switch to it, and only then begin implementation.
- **Why:** Work committed directly on the default branch (or branched off it without a ticket) loses traceability — the eventual PR has nothing to auto-link to, the work doesn't appear on the team's board, and there's no place for context to live. Creating the issue up front, rather than retrofitting one later, is the only way the branch name carries the right tracker ID.
- **How to apply:** At the very start of any non-trivial coding task, run `git rev-parse --abbrev-ref HEAD` (or check the conversation's `Current branch:`). If it's the default branch: pause, invoke the tracker skill to create an issue, then `git checkout -b <user>/<LINEAR-ID>-<slug>` before the first edit. Skip when: you were told not to file a ticket; the work is trivially small/throwaway (typo, one-liner, scratch); the task is already tied to an existing issue that was mentioned; or you're already on a feature branch continuing prior work. When unsure, ask before creating the issue rather than after starting to code. See the `git-github` skill's "Starting work" section for the full convention.
- **The skip decision is the user's, never yours.** Do not *offer* to skip the tracker issue, and do not classify the work as "trivially small" yourself to justify skipping. The skip conditions above are things that must **objectively** already be true (you were told to skip / an existing issue was already named / it's a literal typo or one-liner) — they are not a judgment call you get to make on the user's behalf. If none objectively hold, stop and ask before the first edit. Proposing "I'll skip the ticket unless you say otherwise" is itself the violation: it inverts the default, which is issue-first.
- **Gate the first edit, not the commit.** This check runs *before* the first `Edit`/`Write`, never deferred to commit/PR time. Creating a branch is not sufficient on its own — the branch name must carry the tracker ID, which means the issue has to exist first. A branch like `<user>/<slug>` with no `<LINEAR-ID>` is a tell that you branched before filing the issue; rename it to `<user>/<LINEAR-ID>-<slug>` once the issue exists.

#### Split backend and frontend into separate, layered PRs when they're logically separable

- **Rule:** When a task spans backend and frontend, and the backend work stands on its own (e.g. an endpoint that supports a broader surface than what this frontend consumes), ship them as **two PRs**: one backend PR, and one frontend PR stacked on top of it. Both target the default branch. The frontend branch is created **off the backend branch** (not off the default branch), so the diff stays clean once the backend lands. Note in the frontend PR body that it depends on the backend PR being merged first.
- **Why:** Backend changes that are broader than the immediate frontend need (general-purpose endpoint, schema change, etc.) deserve review on their own merits — independent of UI specifics. Bundling them obscures the backend contract under frontend churn, slows review, and makes rollback all-or-nothing. Stacking the frontend on the backend branch keeps the frontend PR's diff scoped to UI changes only, while still letting you develop both in parallel.
- **How to apply:** When starting a task that has both layers and the backend is logically separable: (1) create the backend branch off the default branch, do the backend work, open PR #1 targeting the default branch; (2) create the frontend branch off the backend branch, do the frontend work, open PR #2 targeting the default branch with a body note that it depends on the backend PR being merged first. If the backend work is trivially small or only meaningful in service of this exact frontend (no broader surface), one combined PR is fine — don't split for its own sake.
- **See also:** the `git-github` skill for branch-naming, PR-targeting, and PR-writing conventions that apply to both PRs.

## Self-audit checklist (run before finalizing)

- [ ] Re-read every rule above.
- [ ] For each rule, scan the diff and confirm compliance.
- [ ] If a rule was violated, fix the code — don't just note it.
- [ ] If the task surfaced a *new* lesson worth saving, flag it so it can be added.
</content>
</invoke>
