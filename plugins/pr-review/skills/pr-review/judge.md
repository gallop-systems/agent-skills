# Judging findings

A reviewer's findings are claims, not facts. Before any finding is fixed or shown to the user, check it against the code. Do this with fresh eyes: a subagent that has not seen the review being produced, or at least a separate pass in which you look for nothing new.

## Keep a finding only if all five hold

1. **The code is as described.** The cited file and line exist and do what the finding says.
2. **A concrete scenario reaches wrong behaviour.** Trace specific values or a sequence of events through the actual code. Look for the guard, lock, constraint, caller or test setup that already prevents it before you keep it.
3. **The diff owns it.** The defect is in code the change adds or modifies, or the change newly exposes it (for example it deletes a route that an untouched button still calls). Behaviour that was already there and is untouched goes in a separate "pre-existing" list, not in the review.
4. **It is a defect.** Not style, naming, wording or a preference.
5. **It needs no unsupported assumption about deployment.** Several app instances, separate database roles, re-running a migration that is already applied, or code that a later PR in the stack removes: keep the finding only if the repository shows the assumption holds.

## Output

For each finding give a verdict and one line of evidence with `file:line`:

- **real**: passes all five. Add impact: high (data loss or corruption, a security or permission hole, wrong money or dates, a crash on a normal path), medium (wrong behaviour a user would plausibly hit), low (rare edge, cosmetic consequence, test or doc quality).
- **pre-existing**: real, but fails rule 3.
- **wrong**: fails rule 1 or 2. Say what prevents it.
- **not a defect**: fails rule 4.
- **unverifiable**: could not be settled from the repository. Say what would settle it.

Never drop a finding silently. Every finding gets a verdict the user can read.

## What to do with the verdicts

- Fix every real high and medium finding. Fix real low findings when the fix is small and local; otherwise list them.
- Show the user the wrong, not-a-defect and unverifiable ones in one compact list so they can overrule you.
- Offer pre-existing findings as follow-up work. Do not fix them in this change.
