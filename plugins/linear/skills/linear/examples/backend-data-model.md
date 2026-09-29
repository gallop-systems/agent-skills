<!--
Title:    Store the technician name and certification date on the visit
Labels:   Feature, Backend, DB
Estimate: M (3)
Note:     Existing columns are named because they go away; nothing new is prescribed —
          no column list, types, or indexes. The Backend lead designs the schema.
-->

**Context:** [Our thinking — Why certification moves off the technician](https://linear.app/<workspace>/document/<our-thinking-doc>) · [How they operate — Where certification dates come from](https://linear.app/<workspace>/document/<how-they-operate-doc>)

---

## Context

The customer keeps technician certification dates in their HR system and doesn't want to maintain technician records in two places. They've asked to just enter the technician's name and certification date on each visit, instead of picking from a technician list.

## Functionality

* Store the technician's name on the visit as free text. It's optional — a visit without a name is an unassigned slot (what we call a slot visit today).
* Store a certification date on the visit, entered by the user. Use it to work out the rate bracket and whether supervision is required, as of the job's scheduling date.
* If the job type requires certification and the visit has no date, flag it the same way we flag an uncertified technician today. Don't guess.
* Remove `visits.technician_id` and the technician/slot visit kinds. Every visit has the same shape, with an optional name.
* This is greenfield, so there's no migration of existing technician visits. Update the seeds to use named visits.

## Acceptance criteria

- [ ] A visit can be saved with a name and a date, with just a name, or with neither
- [ ] Rates and supervision are calculated from the visit's certification date
- [ ] Saving the schedule keeps the name and date on every visit
- [ ] Table and column comments explain the new columns and what they replace
- [ ] Tests written
