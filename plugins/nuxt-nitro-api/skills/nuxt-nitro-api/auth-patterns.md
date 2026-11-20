# Auth Patterns (nuxt-auth-utils)

> **Examples:** [auth-utils.ts](./examples/auth-utils.ts), [auth-middleware.ts](./examples/auth-middleware.ts)

nuxt-auth-utils supports 40+ OAuth providers and includes WebAuthn (passkey) support.

## Server-side Functions (auto-imported)

| Function | Purpose |
|----------|---------|
| `getUserSession(event)` | Get session (null if not logged in) |
| `setUserSession(event, data)` | Create/update session (merges) |
| `replaceUserSession(event, data)` | Replace entire session (no merge) |
| `clearUserSession(event)` | Clear session (logout) |
| `requireUserSession(event)` | Get session or throw 401 |

### Password Utilities

| Function | Purpose |
|----------|---------|
| `hashPassword(password)` | Hash with scrypt |
| `verifyPassword(hash, password)` | Verify password |
| `passwordNeedsRehash(hash)` | Check if rehash needed |

## Client-side Composable

```typescript
const {
  ready,         // Computed<boolean> - session loaded?
  loggedIn,      // Computed<boolean> - is logged in?
  user,          // Computed<User | null> - user data
  session,       // Ref<Session> - full session
  fetch,         // () => Promise<void> - refresh
  clear,         // () => Promise<void> - logout
  openInPopup,   // (url: string) => void - OAuth popup
} = useUserSession();
```

## OAuth Handler Pattern

```typescript
// server/api/auth/google.get.ts
export default defineOAuthGoogleEventHandler({
  config: {
    clientId: config.oauth.google.clientId,
    clientSecret: config.oauth.google.clientSecret,
  },
  async onSuccess(event, { user, tokens }) {
    const dbUser = await findOrCreateUser(user.email, user);

    await setUserSession(event, {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
      },
    });

    return sendRedirect(event, dbUser.role === "admin" ? "/dashboard" : "/home");
  },
  onError(event, error) {
    console.error("OAuth error:", error);
    return sendRedirect(event, "/login?error=oauth");
  },
});
```

Client trigger:
```typescript
const { openInPopup } = useUserSession();
const loginWithGoogle = () => openInPopup("/api/auth/google");
```

## WebAuthn (Passkeys)

```typescript
// Server: Register credential
export default defineWebAuthnRegisterEventHandler({
  async onSuccess(event, { credential, user }) {
    await db.insertInto("webauthn_credentials").values({
      user_id: user.id,
      credential_id: credential.id,
      public_key: credential.publicKey,
    }).execute();
  },
});

// Server: Authenticate
export default defineWebAuthnAuthenticateEventHandler({
  async getCredential(event, credentialId) {
    return await db.selectFrom("webauthn_credentials")
      .where("credential_id", "=", credentialId)
      .executeTakeFirst();
  },
  async onSuccess(event, { credential, user }) {
    await setUserSession(event, { user });
  },
});
```

```typescript
// Client
const { register, authenticate } = useWebAuthn();
await register({ userName: user.email });
await authenticate();
```

## Server Middleware

```typescript
// server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  // Skip auth routes
  if (event.path.startsWith("/api/auth")) return;

  if (event.path.startsWith("/api")) {
    const session = await getUserSession(event);
    if (!session?.user) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }

    // Role-based restrictions
    if (event.path.startsWith("/api/admin") && session.user.role !== "admin") {
      throw createError({ statusCode: 403, statusMessage: "Forbidden" });
    }
  }
});
```

## Client Middleware

```typescript
// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession();
  const publicRoutes = ["/login", "/signup"];

  if (!loggedIn.value && !publicRoutes.includes(to.path)) {
    return navigateTo("/login");
  }

  if (loggedIn.value && to.path === "/login") {
    return navigateTo("/");
  }
});
```

Named middleware:
```typescript
// middleware/admin.ts
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession();
  if (!loggedIn.value || user.value?.role !== "admin") {
    return navigateTo("/");
  }
});

// pages/admin/dashboard.vue
definePageMeta({ middleware: "admin" });
```

## Reusable Auth Helpers

```typescript
// server/utils/auth.ts
export async function getAuthenticatedUser(event: H3Event) {
  const session = await getUserSession(event);
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  return session.user;
}

export async function requireRole(event: H3Event, roles: string[]) {
  const user = await getAuthenticatedUser(event);
  if (!roles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }
  return user;
}

export async function requireAdmin(event: H3Event) {
  return requireRole(event, ["admin", "superadmin"]);
}
```

## Per-resource authorization

Middleware and `requireRole` answer "who is this?" and "what role?". They do not
answer "may this caller touch **this** record?". Reviewers keep finding handlers
that check it on one route and not its sibling, on read but not write, or on the
obvious branch of an update but not the others.

Put the check in one helper that loads the record **scoped to the caller** and
throws, and call it first in every handler under the resource:

```typescript
// server/utils/access.ts
export async function requireProjectAccess(event: H3Event, projectId: number) {
  const user = await getAuthenticatedUser(event);
  const project = await useDatabase()
    .selectFrom("project")
    .selectAll()
    .where("id", "=", projectId)
    .where("account_id", "=", user.accountId)   // the scope IS the check
    .executeTakeFirst();
  // 404, not 403, so ids of other accounts' records aren't confirmed to exist
  if (!project) throw createError({ statusCode: 404, statusMessage: "Not Found" });
  return { user, project };
}

// server/api/projects/[id]/archive.post.ts, and [id].get.ts, [id].patch.ts, [id]/files/*...
const { id } = await getValidatedRouterParams(event, z.object({ id: z.coerce.number().int().positive() }).parse);
const { project } = await requireProjectAccess(event, id);
```

Rules:

- **Every endpoint on the resource**, including nested ones (`/[id]/files`,
  `/[id]/export`), list endpoints (filter by the same scope) and any generic
  "raw read" helper you point restricted users at.
- **Every branch of a write.** If an update can also reactivate, reassign or change
  status, each branch needs the permission that action requires, not just the one
  for the common edit.
- **Ids in the body belong to the parent.** `{ documentIds: [...] }` or
  `{ contactId }` sent to `/api/cases/12` must be checked to belong to case 12 (or
  to the caller), not merely to exist. Otherwise a caller links or edits another
  tenant's rows. Re-check on every transition that makes an old reference matter.
- **Scope mutations to the kind of record they're for.** A `contacts` update must
  `where` on the contact type too, so it can't change another kind of row that
  shares the table.
- **Sessions outlive account changes.** A session cookie stays valid after the user
  is deactivated or their role is lowered. For sensitive actions, have the shared
  guard re-read the user's status/role from the database instead of trusting the
  session copy.

## Type Extension

```typescript
// types/auth.d.ts
declare module "#auth-utils" {
  interface User {
    id: number;
    email: string;
    name: string;
    role: "admin" | "user";
  }

  interface UserSession {
    loggedInAt: string;
  }

  interface SecureSessionData {
    internalToken?: string;  // Server-only
  }
}
```

## Configuration

```bash
# Required (32+ chars, auto-generated in dev)
NUXT_SESSION_PASSWORD=your-super-secret-password-at-least-32-chars

# OAuth (per-provider)
NUXT_OAUTH_GOOGLE_CLIENT_ID=...
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=...
```

## Key Gotchas

1. **Skip auth routes in middleware** - `/api/auth/*` and `/api/_auth/*`
2. **Use `openInPopup` for OAuth** - Better UX than redirect
3. **Cookie size limit is 4096 bytes** - Store only essential data
4. **setUserSession merges** - Use `replaceUserSession` to replace
5. **requireUserSession throws** - Use getUserSession for null
6. **Cannot use with `nuxt generate`** - Requires running server
7. **`navigateTo` external routes need `{ external: true }`** - In-app routes: `navigateTo('/dashboard')`. Server/OAuth endpoints that aren't Vue routes (e.g. `/api/auth/google`, `/api/auth/preview-login`) must pass `navigateTo('/api/auth/google', { external: true })`, or Vue Router tries to resolve them as client routes and fails. Build query routes with `navigateTo({ path, query })` and `String()` any numeric ids.
