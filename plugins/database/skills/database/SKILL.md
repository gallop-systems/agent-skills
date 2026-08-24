---
name: database
description: Query and inspect databases from the command line — local development DBs today, production DBs later. Use whenever you need to look up data, check schema, count rows, or otherwise poke at a database directly (psql, etc.) rather than going through the app. Trigger proactively any time the user asks "does my db have X", "what's in the db", "check the database for Y", or otherwise wants direct DB inspection.
---

# Database

How to access databases directly from the shell. Today this covers local development DBs via `psql`. Production access will be added later — when it is, this skill becomes the single place to look up *any* direct DB access.

## Local database access (psql)

### Always read the project's `.env` to find the connection string

**Do not** assume `$NUXT_DATABASE_URL` (or any other env var) is set in your shell. The shell the agent runs commands in does not inherit the project's `.env` — the var will often be empty or, worse, point at a *different* database than the app uses, and your query will silently run against the wrong DB.

**Before** running any `psql` command:

1. `cat .env` (and `.env.local`, `.env.development` if they exist) in the project root.
2. Find the `*_DATABASE_URL` line.
3. Pass that URL **literally** to `psql`, e.g. `psql "postgresql://localhost:5432/<db-name>" -c "..."`.

Example of the failure mode this prevents: `psql "$NUXT_DATABASE_URL" -c "SELECT ..."` with an unset env var connects to the default DB for the current OS user (often a DB named after your username), which has totally different tables. You'll get "relation does not exist" errors and may conclude the app is missing tables that are actually right there in the correct DB.

### Useful one-liners

Once you have the correct URL:

```bash
# List tables
psql "$URL" -c "\dt"

# Describe a table
psql "$URL" -c "\d <table>"

# Count rows
psql "$URL" -c "SELECT COUNT(*) FROM <table>;"

# Peek at a few rows
psql "$URL" -c "SELECT * FROM <table> LIMIT 5;"
```

Prefer `-c "..."` (single command, exits cleanly) over piping into an interactive `psql` session.

### If a query fails with "relation does not exist"

Before assuming the table is missing, **double-check you're connected to the right database**. Run `psql "$URL" -c "SELECT current_database();"` and confirm it matches what's in `.env`. The most common cause is connecting to the wrong DB (see above), not a genuinely missing table.

## Production database access

Not yet covered. When production access conventions are added, document them here under this `## Production database access` section.
