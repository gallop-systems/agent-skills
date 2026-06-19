## Handling "Excessively Deep Types" Error

### The Problem

Complex queries with many CTEs can overwhelm TypeScript's type instantiation limits:

```
Type instantiation is excessively deep and possibly infinite
```

This commonly occurs with 12+ `with` clauses, as Kysely's nested helper types accumulate.

### The Solution: `$assertType`

Use `$assertType` to simplify the type chain at intermediate points:

```typescript
const result = await db
  .with("cte1", (qb) =>
    qb.selectFrom("user")
      .select(["id", "email"])
      .$assertType<{ id: number; email: string }>()  // Simplify type here
  )
  .with("cte2", (qb) =>
    qb.selectFrom("cte1")
      .select("email")
      .$assertType<{ email: string }>()
  )
  // ... more CTEs
  .selectFrom("cteN")
  .selectAll()
  .execute();
```

**Key points**:
- The asserted type must structurally match the actual type (full type safety preserved)
- Apply to several intermediate `with` clauses in large queries
- TypeScript cannot automatically simplify these types - explicit assertion is required

