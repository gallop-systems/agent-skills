---
name: carry-plan
description: Maintain a per-feature implementation plan in `docs/<slug>.md` that survives across chats while staying out of intermediate commits, then rewrite it as "what was done" and commit it in the final PR. Use eagerly whenever you start or resume an ambitious feature that's likely to span multiple sessions, or the user says things like "carry this across chats", "track this implementation", "keep a plan for this", "pick up where we left off on <feature>", or "finalize the plan for the PR".
---

# Carry-plan

Ambitious features often span multiple chats. The implementation details — data model decisions, edge cases discovered, refactors deferred, open questions — live in chat scrollback and evaporate when a new conversation starts. This skill keeps those details in a markdown file that travels from chat to chat, but does **not** pollute the feature branch with intermediate planning commits. At the end, the same file is rewritten as a description of what was actually built and committed in the final PR.

## When to invoke (eagerly)

Load this skill **without waiting to be asked** whenever any of these apply:

- The user describes an ambitious feature that obviously won't finish in one chat (multi-file backend + frontend + migration, new subsystem, multi-week initiative).
- The user references a feature by name and the work isn't obviously a one-shot ("let's get back to the payment plan rework", "continuing the proposal versioning").
- The user says any of: "carry this across chats", "track this implementation", "keep a plan", "write down the plan", "pick up where we left off", "what were we doing on X", "finalize the plan for the PR", "wrap the plan into the PR".
- You're starting work and there's already a carry-plan doc in `docs/` — i.e. a `.md` whose frontmatter has `carry_plan: true` (see [identification](#identifying-a-carry-plan-doc)) — load it as ground truth before doing anything.

If unsure, invoke. The cost of running this skill on a smaller task is one extra markdown file; the cost of skipping it on an ambitious one is that the next chat starts from zero.

## Identifying a carry-plan doc

> **A markdown file is a carry-plan doc if and only if its YAML frontmatter contains `carry_plan: true`. Nothing else qualifies.**

This is the **single, unambiguous test**. Not "it's a `.md` in `docs/`". Not "it's untracked or modified". Not "it has a `status:` field". Not "the filename looks like a feature name". A doc without `carry_plan: true` in its frontmatter is an ordinary file and gets **no special treatment** — stage and commit it like any other file.

```bash
# Is docs/foo.md a carry-plan doc? (prints "carry-plan" only if it is)
head -20 docs/foo.md | grep -qE '^carry_plan:[[:space:]]*true[[:space:]]*$' && echo "carry-plan" || echo "ordinary file — commit normally"
```

Why this matters: ordinary docs (component references, design notes, READMEs) frequently live untracked or modified in `docs/`. Treating every loose `.md` as a plan file means real documentation never gets committed. The marker exists precisely so there is **never a judgment call** — you check the frontmatter, and the answer is yes or no.

A carry-plan doc is **protected from commits only while `carry_plan: true` AND `status: planning`** (Phase 1). Once it's `status: shipped` (Phase 2), it is meant to be committed.

## The two phases

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1 — PLANNING                                        │
│  frontmatter: carry_plan: true, status: planning          │
│  docs/<slug>.md lives in the tree, is kept out of commits, │
│  gets updated every chat, is NEVER staged or committed.    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │  (feature is done, PR time)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2 — FINALIZATION                                    │
│  frontmatter: carry_plan: true, status: shipped           │
│  Rewrite the file from "plan" voice → "what was done"      │
│  voice, stage it, commit it in the final PR.               │
└─────────────────────────────────────────────────────────────┘
```

The `carry_plan: true` marker is what makes a file a carry-plan doc at all (see [identification](#identifying-a-carry-plan-doc)); the `status` field is the single source of truth for which phase that doc is in.

## Phase 1 — Planning

### Picking a slug

Use a short kebab-case feature name: `payment-plans`, `proposal-versioning`, `enhanced-portal-auth`. If an issue tracker ticket exists, prefer that issue's slug or title-derived kebab. Confirm with the user before creating if there's any ambiguity.

### Creating the file

`docs/<slug>.md` with this structure. **Write the body in plain language — no jargon, no acronyms, no assumed background.** A non-engineer at the company should be able to read it and understand what's being built and why. Save the technical detail for the code itself; the plan file is a shared understanding, not a spec.

```markdown
---
carry_plan: true
slug: <slug>
status: planning
issue: <issue-id-or-empty>
started: <YYYY-MM-DD>
---

# <Feature name in plain English>

## What we're building
One short paragraph, in plain language. What changes for the user
when this is done? Avoid technical terms unless absolutely necessary —
and if one is necessary, briefly explain it the first time it appears.

## Why we're building it
The problem this solves, or the value it adds. Again in plain language.

## How it will work
Bullets describing the user-visible behavior — what someone sees,
clicks, or receives. Not the implementation. If implementation matters
to the plan (e.g. "this will be a background job, so results aren't
instant"), say it in everyday terms.

## Open questions
Things we still need to figure out or confirm. Phrase each as a real
question someone could answer.

## Decisions made
A running list. Each entry: `- <YYYY-MM-DD> — <what we decided> — <why>`.
Keep the "why" short and human, e.g. "so users don't have to log in twice",
not "to avoid redundant OAuth round-trips".

## What's NOT in scope
Things we're deliberately leaving for later. Helps future-us remember
we chose this on purpose.

## Where we left off
A note to the next session: what's done, what's next, anything someone
picking this up would want to know. Update this at the end of every chat.
```

Guideline for the writing voice: if you'd be embarrassed to share the file with a non-technical teammate, simplify it. Code paths, function names, and database tables don't belong here unless they're load-bearing for a decision — and even then, frame them in context ("the table that stores invoices") not as bare names.

### Keeping it out of commits (critical)

The file lives on disk in `docs/` and **is visible in `git status` as an untracked file** — that's intentional. The plan should be visible there so it's obvious it exists and is in flight. The discipline is "never stage it during feature commits", not "hide it from git".

**Always confirm a `.md` is a carry-plan doc before excluding it from a commit.** A file is only protected if its frontmatter has `carry_plan: true` (see [identification](#identifying-a-carry-plan-doc)). Never withhold a `.md` from a commit just because it's untracked, modified, lives in `docs/`, or has a feature-like name — that reasoning is what wrongly strands ordinary documentation. The marker is the test; if it's absent, the file is ordinary and you stage/commit it normally.

```bash
# Run this on any untracked/modified .md before deciding whether to commit it.
# It reports only the genuinely-protected plan files (carry_plan: true AND status: planning).
for f in $(git status --porcelain --untracked-files=all | awk '{print $NF}' | grep -E '\.md$'); do
  head -20 "$f" 2>/dev/null | grep -qE '^carry_plan:[[:space:]]*true' \
    && head -20 "$f" | grep -qE '^status:[[:space:]]*planning' \
    && echo "PROTECTED (carry-plan, Phase 1): $f"
done
# Any .md NOT printed by this loop is an ordinary file — commit it like anything else.
```

Rules that protect a carry-plan doc during Phase 1 (a file with `carry_plan: true` + `status: planning`):

- **Never run `git add .` or `git add -A`** while such a plan file exists in `docs/`. Stage feature changes by explicit path instead. (Path-scoped staging is the safe default regardless.)
- **Never include the plan file in a feature commit.** It only gets committed during Phase 2.
- **Before any `git commit` during Phase 1, sanity-check** that the plan file isn't staged:

```bash
git diff --cached --name-only | grep -F "docs/<slug>.md" && echo "STOP: plan file is staged — unstage before committing"
```

If that grep prints anything, run `git restore --staged docs/<slug>.md` before committing.

- **Don't add the file to `.gitignore`** (that affects everyone on the team) and **don't use `.git/info/exclude`** (that hides it from `git status`, which defeats the point). Visibility is intentional.

### Updating it across chats

At the **start** of every new chat that touches this feature:

1. Read `docs/<slug>.md` end-to-end before any other tool call. Treat it as ground truth for what was already decided.
2. Read the "Where we left off" section first — it's written for exactly this moment.

During work:

- Append to "Decisions made" whenever a non-obvious choice is made (data shape, library, abstraction boundary, deferral). Today's date is in the system context.
- Update "How it will work", "Open questions", and "What's NOT in scope" in place as the picture sharpens. These sections describe the **current** plan, not history.
- Don't write a running narrative of what you did this chat. The decisions list captures the durable parts; the code captures the rest.

At the **end** of every chat:

- Update "Where we left off" to tell the next chat where to pick up. Be specific: file paths, the command to re-run, the next unbuilt piece. Imagine handing it to a colleague who hasn't seen this conversation.

### What does NOT belong in the plan file

- Code snippets that exist (or will exist) in the repo — link to the file/symbol instead.
- Things already documented in `CLAUDE.md`, design docs, or skill files.
- Conversation transcript or "I tried X then Y" debugging logs — only the conclusion belongs (in Decisions).
- Anything that's just restating what `git log` will show after the PR merges.

If the plan file starts looking like a journal, prune it. The Phase-2 rewrite is much easier when the planning file already contains only durable content.

## Phase 2 — Finalization (PR time)

Invoke this phase when the user says any of:

- "finalize the plan", "wrap the plan into the PR", "rewrite the plan for the PR"
- "the feature is done", "ready to ship X"
- Or when you're about to open the final PR for the feature.

Before starting Phase 2, **confirm with the user** that the feature is actually done and the file is ready to be rewritten. The rewrite is destructive (planning voice → shipped voice); don't do it speculatively.

### The rewrite

Rewrite `docs/<slug>.md` from "what we plan to do" voice into "what this feature is and how it works" voice. The audience is a future engineer reading `docs/` to understand the system, not a reviewer of this specific PR.

The same plain-language rule applies — and even more so, because this version lives in `docs/` forever. Anyone at the company, technical or not, should be able to open it and understand what the feature is.

New structure:

```markdown
---
carry_plan: true
slug: <slug>
status: shipped
issue: <issue-id-or-empty>
started: <YYYY-MM-DD>
shipped: <YYYY-MM-DD>
---

# <Feature name in plain English>

## What it does
A short, plain-language description of what someone using the product
can now do (or what now happens automatically). Present tense.

## Why it exists
The problem this solves or the value it adds, in one paragraph.

## How it works (in plain terms)
A walkthrough of the user-visible flow — what someone sees and does,
step by step. If background mechanics matter (e.g. "an email is sent
overnight"), describe them in everyday terms, not in code.

## Notable decisions
The handful of choices a future reader genuinely needs to understand
why the feature looks the way it does. Each one: what we chose, and
why, in plain language.

## What's not included
What was deliberately left out, and roughly what would come next.
```

Drop entirely: "How it will work" (now reflected in the code), "Open questions" (resolved or in "What's not included"), "Where we left off" (no more resuming), the raw "Decisions made" list (curated into "Notable decisions").

Apply the `best-practices` and `git-github` skills' voice conventions — terse, no editorial padding, no "this PR adds…" framing (the doc outlives the PR).

### Staging and committing

The file has been visible as untracked all along. Now it gets staged and committed:

```bash
git add docs/<slug>.md
```

Commit it as part of the final PR — either in the PR's main feature commit or as a dedicated `docs: <slug> documentation` commit, whichever fits the PR's commit structure (see the `git-github` skill for commit-message conventions).

Verify before pushing:

- `docs/<slug>.md` is staged and contains the **shipped-voice** rewrite, not the planning version.
- No other planning artifacts (scratch notes, TODOs about the plan itself) leaked into the commit.
- `git log -p docs/<slug>.md` on the branch shows exactly one addition — the final doc — not a series of planning revisions.

## Things to watch for

- **A `.md` is only a carry-plan doc if its frontmatter has `carry_plan: true`.** Before withholding any markdown file from a commit, check for that marker (see [identification](#identifying-a-carry-plan-doc)). Untracked, modified, in `docs/`, feature-shaped name — none of those make a file a plan. Treating ordinary docs as plans is the failure this marker exists to prevent.
- **Never `git add .` or `git add -A` while a plan file exists.** Nothing hides the file from git — protection is purely "stage by explicit path". One stray bulk-add and the plan lands in a feature commit.
- **Sanity-check `git diff --cached` before every Phase-1 commit** to confirm `docs/<slug>.md` is not staged.
- **The file showing up in `git status` is correct, not a bug.** Don't try to hide it via `.gitignore` or `.git/info/exclude`.
- **One plan per feature, not per chat.** If a plan file already exists for the feature, update it — don't start `docs/<slug>-v2.md`.
- **Don't carry a plan that's actually one-shot work.** If the feature is finishing this chat, just do it and write the doc (if any) directly in shipped voice. The carry-plan dance is overhead.
- **Ask before destructive rewrites.** Phase 2 throws away the planning structure. Confirm the feature is truly done first.
- **Decision dates use the system `currentDate`.** Don't make up dates or use relative ones ("yesterday") in the file.
- **If the user says "ignore the plan" or "start fresh", do that** — but offer to archive the old file (rename to `docs/<slug>.archive.md`) instead of deleting, in case there's content worth recovering.

## Quick reference

| Situation | Action |
|---|---|
| Deciding whether a `.md` is a plan | Check its frontmatter for `carry_plan: true`. No marker → ordinary file, commit normally. |
| Starting an ambitious feature | Create `docs/<slug>.md` with `carry_plan: true` + `status: planning`. It will show as untracked in `git status` — that's expected. |
| Resuming a feature in a new chat | Read `docs/<slug>.md` first; lead with "Where we left off" |
| Made a non-obvious decision | Append to "Decisions made" with today's date |
| End of a chat | Update "Where we left off" with concrete next-step breadcrumbs |
| About to commit feature code | Stage by explicit path; verify `docs/<slug>.md` is NOT in `git diff --cached --name-only` |
| User says "wrap the plan into the PR" | Phase 2: confirm done, rewrite to shipped voice, stage, commit in the final PR |
</content>
</invoke>
