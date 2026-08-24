---
name: knowledge-docs
description: Conventions for authoring and updating the per-client and per-project knowledge documents in Linear (the "Who / How they operate / Our thinking" sets). Use whenever you create, populate, or edit one of these Linear knowledge documents, or when the user asks to "update the docs" for a client team or a project.
---

# Knowledge Documents

Conventions for the per-client and per-project knowledge documents kept in
Linear. These documents exist for **collaboration**: the user holds a lot of
context about a client and a project that teammates don't, and these documents
centralize it so everyone works from the same facts.

There are two parallel document sets, governed by the same rules:

- **Client set** — scoped to a client's Linear team. Describes the client's
  whole business.
- **Project set** — scoped to a single Linear project. Describes only the slice
  of the client's business that this project touches. Project docs are
  **self-contained**: do not assume the reader has read the client docs.
  Establish the facts the project needs on its own.

Everything in "The core separation", "Voice", "Ask, never guess", "Structure the
content", and "Writing / editing procedure" applies to **both** sets. The two
sets differ only in scope, titling, and where they attach in Linear (see "The
document sets").

Use this skill whenever you create, populate, or edit one of these documents.

## The core separation (read this first)

The whole point of each document set is to keep four concepts **strictly
separate**. Never let content leak from one into another.

1. **Who / what it addresses** — facts about the business (client set: the whole
   business; project set: the functions this project touches).
2. **How they currently operate** — facts about their present-day workflow, plus
   a glossary.
3. **Our thinking** — what we believe we can build/solve (not yet real).
4. **The work itself** — the actual to-dos. **This lives in Linear projects and
   issues, NOT in these documents.** These documents describe the goals that the
   work flows from; they never contain the task list.

Each set is currently three documents. A set may grow, but any new document must
respect the same separation: each document owns exactly one of these concepts,
and none of them ever holds the to-do list.

## Voice — non-negotiable

This applies to every one of these documents.

- **Extremely factual and grounded in reality.** Record the *what*.
- **No reasoning.** Do not explain or guess *why* something is the case. If the
  user tells you a fact, record the fact — do not append a rationale, motivation,
  or cause unless the user explicitly stated it.
- **No opinions** unless the user explicitly gave that opinion and told you to
  write it. (Opinions, when licensed, belong only in the "Our thinking"
  document.)
- **No hypothesizing.** Do not speculate, infer, or fill gaps. A gap stays a gap.
- **No flowery language.** No adjectives or phrasing that don't add content. No
  throat-clearing, no summaries of what the document is about, no filler
  transitions. Every sentence must carry a fact.
- Prefer short declarative sentences and lists over prose paragraphs.

If you find yourself writing "because", "in order to", "this suggests", "likely",
"presumably", or "which is great for" — stop. That's reasoning, hypothesizing, or
flourish, and none of it belongs here.

## Ask, never guess

**You do not have the source facts — the user does.** Never populate these
documents from assumption, from the codebase, or from what a client "probably"
does.

- Interview the user for the content. Ask **only** the questions that fit the
  specific document you're filling (see per-document question sets below).
- If the user doesn't know or skips a question, leave that section out — do not
  invent a plausible answer to fill it.
- **Omit gaps silently.** When a fact is unknown, simply leave it out. Never
  write a placeholder or call attention to the absence ("name not recorded",
  "TBD", "unknown", "to be determined"). If you don't have it, it simply isn't
  mentioned.
- Only write what the user tells you. When in doubt, ask rather than write.

## Linear mechanics

These are Linear **documents**. Client-set documents attach to the client's
**team**; project-set documents attach to the **project** (not to a team, issue,
or initiative).

- **Find the project.** From a Linear project URL, the trailing slug is the
  handle (e.g. `.../project/<slug>-<hash>/...` → slug `<slug>-<hash>`). Pass it to
  `get_project` (`query` accepts a name, ID, or slug). Call with
  `includeResources: true` to list documents already attached — the `resources`
  array returns each document's `id`, `title`, and `url`. Use this to see whether
  the document set already exists before creating duplicates.
- **Create a document.** Call `save_document` with **no `id`**, a `title`, and the
  parent set (`project` for the project set, the client's team for the client
  set). Exactly one parent must be given. `content` is Markdown with **literal**
  newlines and characters (never escape sequences like `\n`); mention a person
  with `@displayName`.
- **Update a document.** Call `save_document` **with `id`** set to the document's
  ID or slug. This replaces the whole document (see the re-fetch rule in the
  procedure below). Do not pass a parent on update unless you intend to reparent.
- **Read a document.** `get_document` by `id` or slug. `list_documents` also
  enumerates a set.
- **Titling.** Client-set titles carry a numeric prefix so they stay ordered
  (`01 …`, `02 …`, `03 …`). Project-set titles are **plain names with no numeric
  prefix**.

**Never repeat the document title in the content.** The Linear document already
has a title — do not open the content with an H1 (or any restatement) of it.
Start the content with the first real section or sentence.

## The document sets

Both sets carry the same three concepts. The scope of concept 1 differs by set
(the whole business vs. the functions one project touches); concepts 2 and 3 are
otherwise parallel.

### Document 1 — Who / What it addresses

- **Client set title:** `01 — Who and what is <Client>`
- **Project set title:** `What <Project> addresses`

**Scope.** Client set: strictly what the client does *as a business* — their
business and their business procedures, nothing else. Project set: strictly which
functions of the client's business this project relates to, as facts about their
business — the specific lines of business, procedures, or operations the project
touches, nothing else.

**Explicitly out of scope:** how we acquired them, what solution we want to offer,
what we want to build, technology, our opinions. If it isn't a fact about the
business, it does not go here.

**No client vocabulary here.** This document must be readable by anyone with zero
prior context. Do not use client-specific or industry jargon. Reduce every term
to plain words anyone would understand (e.g. write "documents collected from
suppliers", not the client's shorthand for it). Client terminology is introduced
only in documents 2 and 3: it is *defined* in the document-2 glossary, and once
defined it may be used freely in 2 and 3 — never in 1.

Questions to ask the user:
- What does this client do as a business? (project set: which functions of the
  client's business does this project relate to?)
- What are the core business procedures / lines of business (in scope)?
- Who are their customers and what do they deliver to them? (project set: who
  inside the client performs the work, and who is it for?)
- How is the business (or that part of it) structured — locations, divisions,
  roles — only if the user knows?

### Document 2 — How they currently operate + glossary

- **Client set title:** `02 — How do they currently operate`
- **Project set title:** `How they currently operate here`

**Scope:** how the client works *today* (project set: within the functions this
project touches), and a glossary of their vocabulary.
- How they currently do the work.
- What tools/systems they currently use.
- How they currently solve the problems we may address.
- **Glossary:** client-specific (and, for the project set, project-specific) terms,
  defined, so the team can use the client's own words without guessing what they
  mean.

**Explicitly out of scope:** anything about what we want to offer, what we want to
build, or what they should be doing differently. This is the present-day state
only.

**Document 2 is a living snapshot; it tracks reality as the project ships.** As
parts of our solution get implemented and put into use, the workflow they
introduce stops being provisional and becomes how the client currently operates.
When that happens, move it out of the "Our thinking" document and into this one as
present-day fact. This document should always describe the workflow *as it
actually is now* — including the parts we have already built — not the workflow as
it was before the project started.

Questions to ask the user:
- What is their current workflow, step by step?
- What tools and systems do they use today?
- How do they currently handle the problems we may end up addressing?
- Which terms should go in the glossary, and what does each mean?

### Document 3 — Our thinking (not finalized)

- **Both sets title:** `03 — Our thinking (not finalized)` (client set) /
  `Our thinking (not finalized)` (project set)

**Scope:** what we (the user and colleagues) think we can do — how we could
address the problems above and implement solutions (project set: how we think the
solution for this project will be built). This is the **first** document allowed
to describe things that don't yet exist in the real world.

**Still out of scope:** the actual to-dos. Concrete tasks are Linear
projects/issues, not this document. This captures current thinking — not the
backlog.

Keep the "(not finalized)" marker in the title: this content is provisional.

Even here, the voice rules hold: write only the thoughts the user (or a named
colleague) actually expressed. Do not generate ideas, do not extend an idea with
your own reasoning, do not editorialize about whether an idea is good.

Questions to ask the user:
- What do we think we can do for this client / how do we think the solution will
  be built?
- Which of their problems do we think we can address, and how?
- What solutions, approaches, or components are we considering?
- Whose thinking is this — attribute if it matters?

## Structure the content — do not transcribe

The user will give you facts in the order they occur to them, not in the order
they belong on the page. **Your job is to organize them into a coherent
structure, not to echo them back in spoken order.**

- Reconstruct the underlying model and lay the document out along it — e.g. by
  entity, by layer, or by the sequence in which things actually happen.
- **Place every fact where it belongs, not where it was said.** A detail mentioned
  last may belong in the first section. A cross-cutting attribute (a field, a tag,
  a flag on some entity) must be introduced at the layer where it originates and is
  first needed — never dropped in as a matter-of-fact trailing bullet.
- If you cannot tell which layer or entity a fact attaches to, **ask** (per "ask,
  never guess"). Do not park it at the end to avoid the question. Example: if
  requirements carry tags, find out whether tags are defined on the template, on
  the client, or on the project before you write it up — that determines where it
  goes.
- The finished document should read as though its structure was designed, not as a
  running transcript of the interview.

## Writing / editing procedure

1. Identify which document the content belongs to using the core separation above.
   If the user hands you a mix, sort each fact into its correct document and flag
   anything that's actually a to-do (belongs in an issue, not a document).
2. `get_document` to read current content **immediately before every
   `save_document`** — not just the first time. `save_document` replaces the whole
   document; if anyone edited it since you last read it, you will silently clobber
   their changes. Re-fetch right before you write, diff against what you last saw,
   and preserve any edits you didn't make. Never rely on "what I saved earlier" as
   the current state — the document is shared and changes out from under you.
3. Ask the per-document questions. Write only what the user answers.
4. `save_document` with the content in the user's voice per the rules above.
5. If a fact clearly belongs in a different document than the one you're editing,
   tell the user and put it where it belongs — don't force it in to be convenient.
