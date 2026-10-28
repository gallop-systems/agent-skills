# Output formats

The content is the same in every format: one section per answer or feature, each
with the kind of answer, the why, the steps and the screenshots. What changes is
how much fits and how it is delivered. Whatever the format, you prepare it and
the user sends it.

## pdf (default)

For anything with more than two or three steps, or when the client will print
it or forward it.

- Start from `templates/guide.html`. Page 1 has the title, the date, who it is
  for, a numbered contents list (one line per section, with the outcome), the
  demo-data note and any sign-in or admin note. The first section may start
  under it.
- One `<section>` per answer or feature. Each section after the first starts a
  new page.
- Screenshot widths: `w-s` for a chip, a header or a single control; `w-m` for a
  dialog, a card or a panel; `w-l` for a wide table. Before/after goes in a
  `.pair`.
- Render with `bin/render.mjs` and review the contact sheet. A clean guide has no
  stranded headings, no page holding a single note, and no figure on a different
  page from its step. Eight pages for four answers is normal.
- File name: `<App> - <what it is> - <reader or date>.pdf`, for example
  `Portal - answers for Dana.pdf` or `Portal - what's new - March 2026.pdf`.

## html

The same file as the pdf, before rendering, for the web: a link the client can
open, or a page in the app's own docs.

- Keep `shots/` beside the HTML and use relative image paths.
- If it is going to be published somewhere (an artifact, a docs site), that is the
  user's call. Prepare it, and ask before publishing.

## email

For one to three short answers, or an announcement of one or two features.

- Write a **draft** in the user's voice, never sent by you. Give the subject, the
  body and the list of attachments. If the user has an email tool connected,
  create a draft there only if they ask.
- Subject: what it's about, in their words ("Your questions about order
  documents", "New: orders now wait for the signed form").
- Body: a one-line greeting, then one short paragraph per answer: the answer
  first, then the steps as a numbered list with the exact labels in bold. Refer to
  the screenshots by number ("see screenshot 2"). End with one line offering
  help.
- Attach the screenshots as numbered PNGs (`1-documents-setting.png`, …), in the
  order the body refers to them. For more than about five screenshots, attach
  the pdf instead and keep the body to a summary of each answer.

## whatsapp

For quick answers to someone who asked in a chat.

- **One message per answer**, short enough to read on a phone (about 600
  characters at most). Put a number on each when there are several ("1/3").
- WhatsApp formatting only: `*bold*` (single asterisks), `_italic_`, plain line
  breaks, and numbered steps as `1.` lines. No headings, tables, links in
  markdown syntax, or nested lists.
- Bold the exact button and menu names: `Go to *Admin → Documents*`.
- Screenshots go as separate images, each with a one-line caption, sent after
  the message they belong to. List them in order: message 1, image 1a, image 1b,
  message 2, and so on. Two images per answer at most; crop tight, because they
  are seen on a phone.
- Give the user the messages as plain text blocks, ready to paste, plus the image
  files in order. You never send them.
- If an answer needs more than four steps, say so in the message and send the
  pdf for that part.
