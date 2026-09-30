<!--
Title:    Pick the job type on the job and enter the technician name and date on each visit
Labels:   Feature, Frontend
Estimate: L (5)
Note:     Every path in UI Notes was verified in the repo on main. If the repo can't be
          checked, leave paths out entirely — no "To Determine" / TBD section.
-->

**Context:** [Our thinking — What that means](https://linear.app/<workspace>/document/<our-thinking-doc>) · [How they operate — How the system works today](https://linear.app/<workspace>/document/<how-they-operate-doc>)

---

## Context

Dispatchers set the same job type on every visit of a job, which is repetitive and easy to get wrong. They've also asked to stop picking technicians from a list here — they keep that list in their HR system. They want to pick the job type once for the job, and type the technician's name and certification date on each visit.

## Requirements

- [ ] The job editor lets you pick one job type (or none) next to the service category. No job type means no restrictions.
- [ ] Each visit has a free-text technician name. If it's blank, the visit is an unassigned slot, so the technician/slot toggle goes away.
- [ ] Each visit has a certification date, with a date picker.
- [ ] The visit shows the rate that date gives. If the job type needs a date and there isn't one, show that clearly instead of showing $0.
- [ ] Remove technician search/select from the scheduler.

## UI Notes

* Components: `app/components/JobEditor.vue` (job type picker), `app/components/VisitRow.vue`, `app/components/VisitRatePreview.vue` — checked in the repo.
* Pages: `app/pages/jobs/[id]/edit.vue`, `app/pages/jobs/[id]/index.vue`.
* VoltSelect for the job type, VoltInputText for the name, VoltDatePicker for the date.
* Follow DESIGN_LANGUAGE.md — zinc palette, no decorative shadows.

## Acceptance criteria

- [ ] You can schedule a job from start to finish with a job type and a mix of named and unnamed visits, and the pricing comes out right
- [ ] Nothing in the scheduler references technician records anymore
- [ ] Tests written
