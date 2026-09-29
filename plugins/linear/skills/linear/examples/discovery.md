<!--
Title:    Decide what hours to check overtime thresholds against
Labels:   Discovery, Backend
Estimate: S (2)
Note:     This is an open question only because the requester said it was one — the agent
          never decides on its own that something needs the client. Options carry their
          trade-offs; the answer gets folded into the dependent issues, not logged here.
-->

**Context:** [Our thinking — Overtime thresholds](https://linear.app/<workspace>/document/<our-thinking-doc>) · [How they operate — How the system works today](https://linear.app/<workspace>/document/<how-they-operate-doc>)

---

## Context

Overtime has to keep working once technician records go away, and it depends on a number that only lives on those records.

A job type's rate item can have a `min_weekly_hours` threshold. Below it, the base rate applies; above it, the extra hours are paid at the overtime rate.

Right now we check the threshold against `technicians.weekly_hours`, which is the technician's **total** week across all their jobs. That's different on purpose from `visits.hours`, which is just the hours on one visit — the scheduler warns when they don't match (KEY-92), since a technician who works for two customers has more hours in total than on either visit.

## Open question

What should we compare the threshold against instead?

* **The visit's own `hours`.** It's already there, so there's nothing new to enter. The downside: a technician split across two customers gets judged on each share separately, so they might miss a threshold they actually meet.
* **A second hours field on the visit.** Keeps today's distinction — say, "40 hours a week in total" next to the 20 hours on this visit — but it's one more field to fill in.

If the customer never actually splits a technician across customers, the first option is the answer.

## Acceptance criteria

- [ ] We have an answer from the customer, and it's written up in the project's "Our thinking" doc
- [ ] The issues that depend on this are updated with the answer
