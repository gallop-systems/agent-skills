## ExpressionBuilder (eb) - The Foundation

The `eb` parameter in select/where callbacks provides all expression methods:

```typescript
.select((eb) => [
  eb.ref("column").as("alias"),                    // Column reference
  eb.fn<string>("upper", [eb.ref("email")]),       // Function call (typed!)
  eb.fn.count("id").as("count"),                   // Aggregate function
  eb.fn.sum("amount").as("total"),                 // SUM
  eb.fn.avg("rating").as("avgRating"),             // AVG
  eb.fn.coalesce("nullable_col", eb.val(0)),       // COALESCE
  eb.case().when("status", "=", "active")          // CASE expression
    .then("Active").else("Inactive").end(),
  eb("quantity", "*", eb.ref("unit_price")),       // Binary expression
  eb.exists(subquery),                             // EXISTS
  eb.not(expression),                              // NOT / negation
  eb.cast(eb.val(" "), "text"),                    // Cast value to type
  eb.and([...]),                                   // AND conditions
  eb.or([...]),                                    // OR conditions
])
```

### eb.val() vs eb.lit()

```typescript
// eb.val() - Creates a parameterized value ($1, $2, etc.) - PREFERRED for user input
// Note: eb.val() alone may fail with "could not determine data type of parameter"
// Use eb.cast(eb.val(...), "text") for string values in function arguments
eb.val("user input")                    // Becomes: $1 with parameter "user input"
eb.cast(eb.val("safe"), "text")         // Becomes: $1::text - always works

// eb.lit() - Creates a literal value in SQL
// ONLY accepts: numbers, booleans, null - NOT strings (throws "unsafe immediate value")
eb.lit(1)             // Becomes: 1 (directly in SQL)
eb.lit(true)          // Becomes: true
eb.lit(null)          // Becomes: NULL

// For string literals, use sql`` template instead
sql`'active'`         // Becomes: 'active' (directly in SQL)
sql<string>`'label'`  // Typed string literal
```

### Standalone ExpressionBuilder

For reusable helpers outside query callbacks:

```typescript
import { expressionBuilder } from "kysely";
import type { DB } from "./db.d.ts";

// Create standalone expression builder
const eb = expressionBuilder<DB, "user">();

// Use in helper functions
function isActiveUser() {
  return eb.and([
    eb("is_active", "=", true),
    eb("role", "!=", "banned"),
  ]);
}
```

A predicate helper can also return a callback that receives the query's
`eb`, so the same helper works in any `.where()`/`.having()` on that table:

```typescript
import type { ExpressionBuilder } from "kysely";

// AVOID - raw sql means the column name is an unchecked string.
// A typo or renamed column only fails at runtime.
function nameMatches(name: string) {
  return sql<boolean>`lower(name) = ${name.toLowerCase()}`;
}

// PREFER - eb.fn keeps the column reference type-checked against DB,
// and the value stays parameterized.
function nameMatches(name: string) {
  return (eb: ExpressionBuilder<DB, "user">) =>
    eb(eb.fn("lower", ["name"]), "=", name.toLowerCase());
}

// Both call sites stay identical:
db.selectFrom("user").where(nameMatches(input)).execute();
```

### Conditional Expressions with Arrays

Build dynamic filters by collecting expressions:

```typescript
.where((eb) => {
  const filters: Expression<SqlBool>[] = [];

  if (firstName) filters.push(eb("first_name", "=", firstName));
  if (lastName) filters.push(eb("last_name", "=", lastName));
  if (minAge) filters.push(eb("age", ">=", minAge));

  // Combine all filters with AND (empty array = no filter)
  return eb.and(filters);
})
```

## String Concatenation

Use the `||` operator with `sql` template for clean string concatenation:

```typescript
// RECOMMENDED - Clean and type-safe with eb.ref()
.select((eb) => [
  sql<string>`${eb.ref("first_name")} || ' ' || ${eb.ref("last_name")}`.as("full_name"),
])
// Output: "first_name" || ' ' || "last_name"

// ALTERNATIVE - Pure eb() chaining (parameterized literals)
.select((eb) => [
  eb(eb("first_name", "||", " "), "||", eb.ref("last_name")).as("full_name"),
])
// Output: "first_name" || $1 || "last_name"

// VERBOSE - concat() function (avoid unless you need NULL handling)
.select((eb) => [
  eb.fn<string>("concat", [
    eb.ref("first_name"),
    eb.cast(eb.val(" "), "text"),
    eb.ref("last_name"),
  ]).as("full_name"),
])
```

**Note**: `concat()` treats NULL as empty string, while `||` propagates NULL. Use `concat()` only when you need that NULL behavior.

