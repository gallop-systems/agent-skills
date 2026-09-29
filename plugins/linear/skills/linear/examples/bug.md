<!--
Title:    Invoices list ignores credits in the total
Labels:   Bug, Backend
Estimate: S (2)
Note:     The title states the broken behavior — no "Fix:" prefix. Root cause and location
          come from reading the code on main, not from the reporter's guess.
-->

## Bug

The invoices list shows the total before credits. So an invoice for $1,000 with a $200 credit shows $1,000 in the list but $800 on the invoice page. The invoice page is right.

## Root cause

The list endpoint adds up `invoice_lines.amount` directly. The detail endpoint uses `getInvoiceTotals`, which takes the credits off.

## Steps to reproduce

1. Apply a credit to any open invoice.
2. Open the invoices list.

## Likely location

* `server/api/invoices/index.get.ts` (the list total)
* `server/utils/invoice-totals.ts` (`getInvoiceTotals`, which does it correctly)

## Acceptance criteria

- [ ] The list and the invoice page show the same total, with or without a credit
- [ ] Tests written
