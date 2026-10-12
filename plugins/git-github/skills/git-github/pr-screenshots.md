# Screenshots in PRs and Issues (`gh --attach`)

A reviewer can't judge a visual change from a class-string diff. For any PR that changes something a user can see, put **before** (base branch) and **after** (PR branch) images in the body. An agent can do the whole thing unattended.

## Uploading: native `gh --attach`

`gh` 2.99+ uploads images and videos itself. `--attach` exists on `gh pr create`, `gh pr edit`, `gh pr comment`, `gh issue create`, `gh issue edit` and `gh issue comment` (not `gh pr review`), up to 50 files per command. Write relative references in the body; `gh` uploads each attached file and rewrites the matching reference to a `github.com/user-attachments/assets/...` URL. Attached files the body doesn't reference are appended at the end.

```bash
# body.md: | ![Before: <what is wrong>](./before.png) | ![After: <what is fixed>](./after.png) |
cd <dir with body.md and the PNGs>          # relative refs resolve from here
gh pr edit <n> --body-file body.md --attach ./before.png --attach ./after.png
gh pr view <n> --json body --jq .body | grep '!\['   # every ref should now be user-attachments
```

- Alt text: `--attach './login.png#The login error state'`, or write it in the body reference.
- To add images to an existing body: `gh pr view <n> --json body --jq .body > body.md`, insert a `## Screenshots` section, then `--body-file body.md` as above.
- Uploads are GitHub user attachments, so on a **private repo they stay private** to people with access. Prefer this over third-party uploaders: some push images to a **public** "images" repo (visible to anyone with the URL), others work by reading the browser's GitHub **session cookie**, which grants full account access.

## Capturing: headless browser, not a screenshot app

GUI screenshot tools (Shottr, CleanShot, etc.) need an interactive region drag, so an agent can't drive them. Use `playwright-core` (install it in a scratch directory, not the project) pointed at a Chromium that's already cached:

```js
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "<~/Library/Caches/ms-playwright/chromium_headless_shell-*/.../chrome-headless-shell>" });
const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:<port>/<dev-login-route>");   // establish a session first
await p.goto("http://localhost:<port>/<page>", { waitUntil: "networkidle" });
const box = await p.locator("<changed element>").boundingBox();
await p.screenshot({ path: "after.png", clip: { x: box.x - 260, y: box.y - 16, width: box.width + 420, height: box.height + 32 } });
await b.close();
```

- **Clip to the change plus its neighbors** (the toolbar row, not the full page), so the reviewer sees it in context without hunting.
- **Auth:** find the app's dev-only login (a preview/dev login route behind an env flag, a seeded user). If the user's running dev server doesn't have it enabled, start a **second** dev server on another port with the flag set, rather than restarting theirs. Stop it when done.
- **Interaction-only states** (open menu, dialog, hover): click or hover, wait a few hundred ms, then capture an extra after-only shot.

## Getting the "before" shot

Take the after shots on the branch, then swap only the changed UI files back to the base and let HMR reload:

```bash
git checkout <base> -- <changed UI files>     # HMR picks it up
# ...capture before.png...
git checkout HEAD -- <changed UI files>
git status -s                                 # must be clean again
```

Make sure the local data actually exercises the change (e.g. a record in the state where the control renders). Look at every image before attaching it: a shot that doesn't show the difference is worse than none.
