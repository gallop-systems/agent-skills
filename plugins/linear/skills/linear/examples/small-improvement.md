<!--
Title:    Let app pages use the full window width
Labels:   Improvement, Frontend
Estimate: XS (1)
Note:     A small, fully-understood change stays small: one requirement, one criterion.
          No doc header — this project has no "Our thinking" / "How they operate" docs.
-->

## Context

People on wide screens have asked for more room. Every app page is capped at `max-w-6xl` and centered, so tables and the schedule view get squeezed while both sides of the screen stay empty.

## Requirements

- [ ] Remove `max-w-6xl mx-auto` from `PageHeader` and from each page's filter bar and main content wrapper. Keep the side padding as it is.

## UI Notes

* Component: `app/components/PageHeader.vue`
* Pages: customers, jobs (index, `[id]`), invoices, schedule, settings, users

## Acceptance criteria

- [ ] Pages and their headers stretch to the full window width, with the same side padding as before
