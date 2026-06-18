# Databases, Spaces, Droplets, DNS

## Managed Databases

```bash
doctl databases list --format ID,Name,Engine,Version,NumNodes,Size
doctl databases connection <db-id> --format URI --no-header   # full credentialed URI
doctl databases ca <db-id>                                    # cluster CA certificate
```

- **The connection URI contains live credentials** — treat command output as a secret. Don't echo it into logs; pipe it directly to where it's needed.
- **Check `Version`** and keep CI/local database versions in sync with production — a test suite running `postgres:15` against a pg-18 production cluster hides version-specific behavior.
- Connections use port 25060 with `sslmode=require`. **TLS trap**: some clients (e.g. `pg-connection-string` as bundled with `pg` >= 8.16) silently treat `require` as `verify-full`, which rejects DO's self-signed CA under the default trust store (`SELF_SIGNED_CERT_IN_CHAIN`). Two non-obvious parts:
  - **An ssl option set in code does NOT override an `sslmode` already in the URI.** Passing `ssl: { rejectUnauthorized: false }` while the connection string still ends in `?sslmode=require` keeps failing — the URI's `sslmode` wins. The fix has to land in the URI itself: drop/replace `sslmode`, append `uselibpqcompat=true` (restores libpq semantics: encrypt but don't verify), or supply the CA from `doctl databases ca <db-id>` explicitly.
  - **When you can't edit the URI** — specifically, when you bind App Platform's generated `${db.DATABASE_URL}` straight into an env var in the app spec, it always carries `?sslmode=require` and you don't author the string — append the param to the bound value: `value: ${db.DATABASE_URL}&uselibpqcompat=true`. This only applies to that bound-pipethrough case; if you declare the connection-string env var yourself, just put the right params (or none) in from the start and an in-code ssl option is enough.

## Spaces

**`doctl spaces` manages access keys only — not buckets.** Create and manage buckets with the `aws` CLI (or s3cmd) against the Spaces endpoint:

```bash
aws s3 mb s3://<bucket> --endpoint-url https://<region>.digitaloceanspaces.com
```

Keys:

```bash
doctl spaces keys create <name> --grants 'bucket=<bucket>;permission=readwrite' -o json > /tmp/key.json
doctl spaces keys list
doctl spaces keys delete <ACCESS_KEY>      # no --force flag; prompts — use `yes |` when non-interactive
```

- Grant permissions: `read`, `readwrite`, `fullaccess`. An empty `bucket=` grants all buckets.
- **The secret key is shown exactly once, at creation.** Capture it to a temp file with `-o json`, never print it, and delete the file after storing it where it belongs.
- Unlike most doctl delete commands, `spaces keys delete` has no `--force` flag (it errors `unknown flag`).
- Bootstrap pattern: create a temporary `fullaccess` key to create the bucket, mint a bucket-scoped `readwrite` key for the app, swap it in, then delete the full-access key.

## Droplets

```bash
doctl compute ssh-key list                  # find key IDs (match yours via ssh-keygen -l -E md5)
doctl compute droplet create <name> --region <region> --size s-1vcpu-1gb \
  --image ubuntu-24-04-x64 --ssh-keys <key-id> --enable-monitoring --wait
doctl compute droplet list --format Name,PublicIPv4,Status
doctl compute ssh <droplet-name>            # ssh by name (interactive)
doctl compute firewall list --format Name,InboundRules,DropletIDs
```

`--wait` blocks until the droplet is active, so the IP is immediately available from `droplet list`. For non-interactive remote commands prefer plain ssh: `ssh -o StrictHostKeyChecking=accept-new root@<ip> "<cmd>"`.

## DNS

Domain commands live under `compute` — `doctl domains ...` fails with `unknown command`:

```bash
doctl compute domain list
doctl compute domain records list <domain>
```
