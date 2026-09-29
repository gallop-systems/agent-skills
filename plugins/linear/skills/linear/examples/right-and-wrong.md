# Issue Writing — Right and Wrong

Each pair is a real correction made on a drafted issue. ❌ is what agents tend to write; ✅ is how we write it.

## Titles

```
❌ Fix: Invoice list total wrong
❌ [ACME] UI: Add quote email
❌ Spike: overtime hours
✅ Invoices list total doesn't include credits
✅ Send a quote by email from the platform
✅ Decide what hours to check overtime thresholds against
```

No prefixes at all — no client, no domain, no `Fix:` / `Chore:` / `Spike:`. The team already identifies the client, and the labels show the type and domain. Just say what the issue is about.

## Framing

```
❌ ## Context
   Add a Send button to the quote page that emails the PDF through Resend.

❌ ## Context
   Dispatchers want to email quotes from the platform, which will improve
   customer satisfaction and reduce churn.

✅ ## Context
   Dispatchers say getting a quote out to a customer takes too long. Right now
   they generate it, download it, and email it from Outlook. They want to send
   it without leaving the platform.
```

Frame the issue around the intent — who has the problem and what they're trying to get done — not the fix. The first ❌ goes straight to the solution. The second is framed around intent, but it includes a reason nobody gave. The reason always comes from the requester; if they didn't say why, ask them.

## Describing things literally

```
❌ The generated quote PDF is currently silent on tax.
❌ The list endpoint ignores credits and doesn't know about partial payments.

✅ The generated quote PDF doesn't include a tax line.
✅ The list endpoint doesn't subtract credits or partial payments.
```

Documents, code, and systems don't speak, know, want, or ignore anything. Say what they do or what they contain.

## Backend: behavior, not schema

```
❌ Add a `quote_sends` table:
   - id (bigint, PK)
   - quote_id (bigint, FK → quotes.id, indexed)
   - status (text, CHECK in ('queued','sent','failed'))

✅ * Recipients have to be contacts of the job's customer. Contacts without an
     email address can't be picked.
   * We're not keeping a record of sends for now. That's out of scope for this
     revision.
```

Say what needs to happen, the business rules, and what's out of scope. The Backend lead decides the tables, columns, types, indexes, and constraints. It's fine to mention columns and endpoints that already exist — just don't design new ones.

## Status and enum fields

```
❌ status: `draft`, `sent`, `accepted`, or `expired`

✅ We need to be able to tell whether a quote is still being edited, sent but
   not answered yet, accepted, or expired. Only quotes still being edited can
   change, and the jobs list filters on the other three.
```

Explain what the status needs to tell apart and what depends on it. Let the implementer name the values.

## Grounding in the repo

```
❌ Lift the rate math out of `useMockRates.ts` on the wireframe branch.
❌ Per the plan in KEY-29, rates will come from the job type — that's wrong,
   instead...
❌ ## To Determine
   - [ ] Which page renders the jobs list?

✅ The list endpoint adds up `invoice_lines.amount` directly. The detail
   endpoint uses `getInvoiceTotals`, which takes the credits off.
```

Describe what the code on `main` does today, and check it. Don't point at a wireframe branch or a scratch file the assignee might not have — paste what matters into the issue instead. Don't frame the issue around another issue's plan. If you can't check the repo, leave file paths out rather than adding a TBD section.

## Links between issues

```
❌ Upstream data capture lives in Scheduling: KEY-14 (captures the visit
   hours). Backend generation is handled by KEY-15 (blocking).
❌ see the Job Scheduling project
❌ ## Sub-issues
   - KEY-201
   - KEY-202

✅ ...the scheduler shows a warning when they don't match (KEY-92), since a
   technician who works for two customers...
```

Link another issue inline, by its identifier, the first time you mention something it covers — once per issue is enough. Dependencies go in Linear relations, not in the text. Linear already shows sub-issues, so don't list them. Anything you name — a project, an issue, a doc — should be a link.

## Open questions

```
❌ ## Open questions
   - Should the send be logged? (needs a meeting with the client)
   - Which template should the default body use?

✅ (asked the requester before writing — both answers are now in the body)
   * We're not keeping a record of sends for now...
   * The frontend sends the subject and body...
```

Ask the requester everything before you write. Only put a question in the issue if the requester tells you it's an open question — don't decide on your own that it needs a meeting.

## After a clarifying answer

```
❌ ## Functionality
   * Send to a single recipient.
   ...
   ## Update (2025-05-01) — clarified with requester
   * Actually, more than one recipient per send.

✅ ## Functionality
   * Send an existing quote to one or more recipients...
```

The body should always read as the current spec. When an answer changes something, rewrite that part so it reads as if it always said that. No "Update", "Decisions", or "Clarifications" sections, no dated headers, and no struck-through text.
