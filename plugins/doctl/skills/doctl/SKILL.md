---
name: doctl
description: Manage DigitalOcean App Platform deployments with doctl CLI. Covers auth contexts, listing apps, monitoring deployments, and checking logs.
---

# DigitalOcean doctl CLI Patterns

This skill provides patterns for managing DigitalOcean resources via the `doctl` CLI, focused on App Platform.

## When to Use This Skill

Use this skill when:
- Deploying or monitoring apps on DigitalOcean App Platform
- Switching between DigitalOcean auth contexts
- Checking deployment status or logs
- Listing apps and their deployments

## Auth Contexts

doctl supports named auth contexts for managing multiple accounts/teams.

```bash
# Switch to a named context
doctl auth switch --context <context-name>

# List available contexts
doctl auth list
```

Always switch context before running commands against a specific account.

## App Platform

### Listing Apps

```bash
# List all apps (shows ID, name, ingress URL, deployment status)
doctl apps list
```

Key columns: `ID`, `Spec Name`, `Default Ingress`, `Active Deployment ID`, `In Progress Deployment ID`.

The app ID is a UUID — you'll need it for all subsequent commands.

### Monitoring Deployments

```bash
# List recent deployments for an app
doctl apps list-deployments <app-id>
```

Key columns: `ID`, `Cause`, `Progress` (e.g. `6/6`), `Phase`.

Deployment phases:
- `PENDING_BUILD` — queued
- `BUILDING` — build in progress
- `DEPLOYING` — deploying built artifacts
- `ACTIVE` — successfully deployed and serving traffic
- `SUPERSEDED` — replaced by a newer deployment
- `ERROR` — deployment failed

The `Cause` column shows which commit triggered the deploy.

### Deployment Logs

```bash
# Get build logs for a specific deployment
doctl apps logs <app-id> --deployment <deployment-id> --type build

# Get runtime logs
doctl apps logs <app-id> --type run

# Follow logs in real-time
doctl apps logs <app-id> --type run --follow
```

Log types: `build`, `deploy`, `run`, `run_restarted`.

### Getting App Details

```bash
# Get full app spec (useful for seeing components, env vars, routes)
doctl apps get <app-id>

# Get app spec as yaml
doctl apps spec get <app-id>
```

## Common Gotchas

- **Column names in `--format`**: doctl's `--format` flag is picky about column names. If you get `unknown column` errors, run the command without `--format` first to see available columns, then filter with standard tools like `head`.
- **Deployment auto-trigger**: Apps connected to GitHub auto-deploy on push to the configured branch. No manual deploy needed unless auto-deploy is off.
- **App ID vs Name**: Most commands require the app UUID, not the human-readable name. Get it from `doctl apps list`.
