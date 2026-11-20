# Deep mode: one focused reviewer per concern

One reviewer looking for everything finds the loud problems. Splitting the review into narrow concerns, each with its own reviewer and the same context brief, finds about three times as many confirmed defects, most of them low impact, and roughly five times as many claims to judge. Use it for changes that touch money, permissions, migrations or concurrency, or when the user asks for a thorough review. Always follow it with the judge step: about four in ten of its claims do not survive.

## Plan

List the changed files (`git diff --name-only <base>...HEAD`) and give each file to the concerns its type calls for. Run only the concerns that have files.

| Changed file | Concerns |
|---|---|
| Test files (`.test.`, `.spec.`, `tests/`) | tests |
| Migrations | migration |
| Markdown | docs |
| `.vue`, `composables/`, `stores/` | ui |
| Other code (`server/`, `shared/`, `.ts`, `.js`, `.sql`, scripts) | concurrency, agreement, inputs, access |

## Prompt for each reviewer

Run the reviewers in parallel, each as its own `codex exec -s read-only` (or a read-only subagent), from the repository root:

```text
You are one of several reviewers of the change `git diff BASE...HEAD` in this repository. Your assignment is ONE concern only: <title>.

Files in scope for you:
<the files planned for this concern>

<the concern's questions>

Follow the code beyond the diff wherever these questions lead: read callers, sibling handlers, schemas and tests. Do not modify any file and do not use the network. Ignore every other kind of problem; other reviewers have them.

Finish with a numbered list of findings. For each: the file path and line, a one-sentence title, and a short explanation with a concrete scenario (specific values or a sequence of events) that produces the wrong result. If you cannot give such a scenario, leave the finding out. If you find nothing, say so in one line.

A context brief was prepared before the review. Use it as a map of where to look; verify everything against the files.

<the context brief>
```

Then merge the lists, drop duplicates (the same cause on the same code, even if worded differently), and judge every remaining finding ([judge.md](judge.md)).

## The concerns

**tests: Tests that do not test their claim.** For each changed test: does the body exercise what its name says? Could it pass if the feature were broken (fixture that cannot fail, assertion that accepts any error, `.catch` that swallows, wrong mock route, clock not pinned near a day boundary, timing-based proof)?

**docs: Docs that contradict the code.** For each changed doc sentence, label or comment: find the code it describes and check that the code does exactly that, including exceptions, defaults, limits and names. Also check that sections of the same doc agree with each other.

**migration: Migration safety.** For each migration: does `down()` undo `up()` and can `up()` run again after it? Is the backfill reading the right source for every existing row? Can a write path now violate a new CHECK, unique or foreign-key constraint, or a changed state column leave its coupled column inconsistent? Long locks on large tables? Are generated types in sync?

**ui: Frontend state and async ordering.** For each changed component, page or composable: (1) what state survives when a dialog reopens, the selected record changes, or a prop changes, and should it? (2) can an older request, poll or save resolve after a newer one and overwrite it? (3) what does the user see when each fetch fails: is it distinguishable from empty, and does code that awaits `refresh()` check the error? (4) can the submit handler run twice (Enter, IME Enter, double click)? (5) after a mutation, is every fetch that shows that data refreshed? (6) do the displayed values and the submitted payload come from the same computation?

**concurrency: Races and atomicity.** For each changed write path: is every check that the write depends on made inside the same transaction, on a locked row or backed by a constraint whose violation is mapped to the right error? What if two requests overlap, or a delete or deactivate lands between the read and the write? Are multi-step writes (including calls to external services) atomic or recoverable when a later step fails? Is a guard row written before the step it guards can fail?

**agreement: Paths that must agree.** For each changed function, query or endpoint: find the other code that does the same job or depends on it (create vs update vs delete, list vs count, preview vs save, client check vs server validation, import vs edit, export vs display, a guard and the join it protects). Do they normalise and compare identifiers the same way (trim, case, padding)? Do they apply the same filters, limits and exclusions (deleted, cancelled, inactive, superseded)? Is a LIMIT or "first match" applied before the exact-match, access or dedupe filter? Does the code read the current row or a stale snapshot, and does an upsert or update overwrite fields it should preserve?

**inputs: Inputs, boundaries and failures.** For each changed input and computation: can the schema accept a value the code cannot handle (impossible calendar date, non-canonical format, NaN from `Number()`, over-long string, mutually exclusive params)? Does a truthiness check drop a legitimate `false`, `0` or empty value? Day boundaries and time zones (UTC vs local day, inclusive ranges, multi-day spans), rounding, text-sorted numbers, zero rows or a missing relation? Does a catch or default turn a real failure into a misleading success, or one bad item fail a whole batch?

**access: Permissions and exposure.** For each changed endpoint or tool operation: who may call it, and is that enforced on this path and every sibling path (deactivate/reactivate, bulk, export)? Can a caller reach another tenant's or user's rows by passing an id? Is sensitive data written to logs, responses, caches or error messages? Any redirect, URL fetch or generated file (CSV) built from user input?
