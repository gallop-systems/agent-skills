---
name: generate-documentation
description: Write a client-facing guide with screenshots of the app, as a PDF, HTML page, email or WhatsApp messages. Two modes. "answer" turns a client's questions into answers ("you can already do this, here's how", "we changed it, here's how it works", "here's why that happened and the fix"). "announce" turns merged work into an unsolicited "you can now…" note. Use when the user wants to send a client or their staff documentation, a how-to, release notes, a "what's new" or answers to their questions about a Gallop app, even if they don't say "documentation".
argument-hint: <pdf|html|email|whatsapp> <answer: pasted questions | announce: PR, branch, or "what merged since …">
---

# Generate client documentation

You are writing for the client's staff: people who use the app every day and do
not read code. The result is a document they can follow alone, with real
screenshots of the app, that never shows real client data.

Arguments: a **format** (`pdf`, `html`, `email`, `whatsapp`; default `pdf`) and
what to document. Work out the **mode** from what you are given:

- **answer**: their questions or messages (pasted, a screenshot, an email). Each
  question gets a section.
- **announce**: work that shipped (a PR, a branch, "everything merged since
  Monday", or "the feature we just built"). Each user-visible change gets a
  section. Nobody asked; you are telling them what they can now do.

If the format or the mode is unclear, ask once. Everything else you decide.

Format-specific output rules are in [formats.md](formats.md). Read it before
writing.

## 1. Work out what is true

Do this before taking a single screenshot. A guide that confidently describes the
wrong thing is worse than no guide.

### answer mode

Split the messages into separate questions (people send several in a row). For
each one, find out from the code, the in-app docs and the data (read-only) which
of these it is:

| Kind | Tag in the guide | What the section does |
|---|---|---|
| They can already do it | **You can do this already** | Numbered steps with screenshots |
| It needed a change, and we made it | **New** | How it works now, with screenshots, and the rules |
| A setting, data or setup problem | **A setting to fix** | Why it happened, then the fix |
| Not possible yet | (leave out, or **Not yet**) | Say so plainly; ask the user whether to build it before you write anything |
| Something only they can tell you | **Needs your answer** | Ask the question; don't guess |

Look at how the status or behaviour they're asking about is *derived*, not just
what it is called. "Why does it say Ready to send?" is usually answered by the
rule behind the label (a list of required items, a permission, a filter on an import).
Fixing the input to that rule is usually something they can do themselves.

For a question about records that are missing or wrong, check the actual records
(read-only) and the job that is supposed to bring them in (when it last ran,
whether it failed, what it filters on). If you cannot read production, give the
user a read-only query to run and wait for the result. Don't write the section on
a guess.

### announce mode

Collect what shipped: `gh pr view <n> --json title,body,files`, `git log
<range>`, or the merged PRs since a date. Then keep only **user-visible
changes**. Drop refactors, tests, dependency bumps, internal tooling and
performance work nobody will notice.

For each change that is left:

- Read the diff for its real behaviour: what staff see, what they click, what
  changes on its own, and what changes the day it goes live (existing records that
  will suddenly look different). That last one is the thing clients most need to
  hear in advance.
- Read the page's in-app doc if the repo has them (Gallop portals keep one beside
  every page). If the PR changed behaviour and didn't update that doc, tell the
  user. Don't paper over it in the guide.
- Check who can use it. Admin-only screens either go in an admin-only guide or
  are marked "ask your admin".
- Check it has been merged, or deployed if the user says the client already has
  it. Never announce work that is still in progress.

Several changes make one short "What's new" guide. One feature makes a one-pager.

## 2. Try every step in the app

Before writing a step, do it in the running app on demo data: click every button
you are about to tell them to click. This is where wrong answers show up. A
move the guide said would work gets refused because the target record lacks a permission.
A setting turns out to be admin-only. A label on screen differs from the code's
name for it. When doing it shows your earlier answer was wrong, fix the answer,
and tell the user what changed.

## 3. Screenshots, from demo data only

**Never capture from a database or environment holding real client data**, not
even "just to look". The pictures go to the client and may be forwarded on.

1. **Find the safe data.** Read the repo's CLAUDE.md. Gallop Nuxt apps usually
   have a fictional demo database and a dev server for doc screenshots (for
   example `yarn docs:demo-data` and `yarn docs:dev`), plus a dev-only preview
   login (`/api/auth/preview-login`). Build a **scratch copy** of the demo
   database under its own name, and serve it on its own port, so you don't clash
   with other sessions. If the repo has no fictional data source, stop and tell
   the user. Don't screenshot real data, and don't invent data in a real database.
2. **Stage the scenarios** in the scratch database with SQL: the record that
   shows the problem, the setting before it is fixed, the record filed under the
   wrong owner. Use the same kind of record the client described, with made-up names.
   Remove anything that distracts from the point (an unrelated badge on the same
   card).
3. **Script the captures.** Copy [bin/capture-example.mjs](bin/capture-example.mjs)
   to a scratch directory and write one step per section; it imports
   [bin/shots.mjs](bin/shots.mjs). Run it from the app repo
   (`cd <repo> && node <scratch>/capture.mjs <out-dir> [step]`), so Playwright
   resolves from there. For each step, capture before, the action and after.
   Ring the thing to click with `mark()`.
4. **Look at every image** before using it. Common faults: the crop cuts off the
   heading, the wrong column was clicked, a dialog is half-rendered, or the
   picture shows a state from a previous run.
5. **Reset what a step changed**, at the start of that step, so any step can be
   re-run alone.

Capture gotchas:

- Find table columns by their header text, never by position: an index that was
  right for one table clicks the neighbouring column of the next. A cell that
  cycles states (Required → Optional → none) will have been changed by the wrong
  click, so check the data and put it back.
- Write capture scripts as `.mjs`. A `.ts` file run through `tsx` outside a
  `"type": "module"` package fails on top-level `await`
  (`ERR_REQUIRE_ASYNC_MODULE`).
- Use `element()` for dialogs and drawers. For a panel, frame it with `shot()`
  on its heading and its last line, or find it with
  `xpath=ancestor::*[.//button[normalize-space()='…']][1]`.
- A Nuxt dev server freshly started after a lockfile change can 500 every
  request with "IPC connection closed" while Vite re-optimizes. Restart it once.
- Image viewers, the Read tool included, can cache an image by its path.
  When you regenerate a review image, give it a new name.

## 4. Write it

The writing rules hold in every format:

- **Their words, the app's labels.** Head each section with their question or the
  feature in plain words. Name every button, menu and field exactly as it appears
  on screen, in bold. No file paths, routes, table names, code or developer terms.
- **Second person, short sentences, one action per step.**
- **Say why before how**, in a sentence: "An order says Ready to ship once every
  required document is in, and this product line doesn't require the signed
  form." Then the steps.
- **Say who can do it.** If a step needs an admin, or a particular sign-in, say so
  at the top of the guide and at the step.
- **Say what else it changes.** A setting changed for one record usually applies
  to all of them. Say so, and give the narrower alternative when there is one.
- **Warn about day one.** If going live will change how many existing records
  look, say what they'll see and that it is expected.
- **Warn about doing both.** When there are two ways to fix something and doing
  both creates a duplicate, say "pick one".
- **"Please confirm first"** when the right fix depends on a fact only they know
  (is this supplier the contract holder, or working under someone else's?). Give both branches.
- **Note the demo data** once, near the top: the screenshots use made-up records,
  so the names differ but the screens are the same.
- Don't apologise, don't mention AI, and don't describe how you investigated.

## 5. Render, review, deliver

- **pdf and html:** start from [templates/guide.html](templates/guide.html) (its
  header comment lists the building blocks), then render with
  `node <skill-dir>/bin/render.mjs <guide.html> <out.pdf> --footer "<App name>"`,
  run from the app repo. **Look at the contact sheet it prints.** Fix a heading
  stranded at the foot of a page, a page holding a single note, or a figure
  separated from its step: use `.keep` wrappers, a smaller figure width, or move a
  note above its figures. Re-render, and look again.
- **email and whatsapp:** see [formats.md](formats.md).
- Save the deliverable where the user can open it, and hand it over (attach it
  where your environment can). **Never send it yourself.** Emails are drafts,
  WhatsApp text is for the user to paste, and publishing anything waits for
  their yes.
- Then clean up: stop the dev servers you started, drop the scratch databases,
  and undo any launch-config entries you added. Keep the capture script in
  scratch so the user can ask for a retake.

In your reply, give the user the file, a line per section, and anything you
found that changes an earlier answer. Also list any open question the guide asks
the client to confirm.

## Contributing Back

This skill grows by capturing what it missed. If you just worked through something in this domain that this skill did not cover — an error you had to figure out, a behavior that contradicts what is documented above, a workflow knot — ask the user: **"Want me to contribute this back to the generate-documentation skill?"**

If yes, run `/contribute-skill`. If that command is not available, do the equivalent inline: distill the generic lesson (placeholders only — no project names, IDs, domains, or secrets), then branch or fork [gallop-systems/agent-skills](https://github.com/gallop-systems/agent-skills) and open a PR editing this skill.
