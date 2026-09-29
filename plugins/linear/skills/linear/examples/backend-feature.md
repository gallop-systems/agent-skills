<!--
Title:    Send a quote by email from the platform
Labels:   Feature, Backend
Estimate: M (3)
Relation: KEY-141 (the sending-address decision) is linked inline, not narrated
-->

**Context:** [Our thinking — Recipients and template](https://linear.app/<workspace>/document/<our-thinking-doc>) · [How they operate — Customer contacts](https://linear.app/<workspace>/document/<how-they-operate-doc>)

---

## Context

Dispatchers say getting a quote out to a customer takes too long. Right now they generate it, download it, and email it from Outlook. They want to send it without leaving the platform.

## Functionality

* Send an existing quote to one or more recipients, with the quote PDF attached (the one from `/api/jobs/:id/quotes/:quoteId/pdf`).
* Recipients have to be contacts of the job's customer (`contacts` rows with that `customer_id`). Contacts without an email address can't be picked.
* Send from the logged-in user's own email address, as decided in KEY-141.
* The frontend sends the subject and body — it fills in a default from a template, and the user can edit it. The backend sends the subject and body exactly as submitted and doesn't replace the body.
* Reject the send if any recipient isn't a contact of the job's customer.
* We're not keeping a record of sends for now — what was sent, to whom, when, or whether it was delivered. That's out of scope for this revision.

## Acceptance criteria

- [ ] Each valid recipient gets the quote, sent from the user's own address
- [ ] Sending to someone who isn't a contact of the job's customer fails
- [ ] Sending to a contact with no email address fails
- [ ] Tests written
