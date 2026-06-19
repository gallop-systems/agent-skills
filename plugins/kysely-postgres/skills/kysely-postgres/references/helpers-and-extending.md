## PostgreSQL Helpers Summary

All helpers from `kysely/helpers/postgres`:

```typescript
import {
  jsonArrayFrom,    // One-to-many relations (subquery → array)
  jsonObjectFrom,   // Many-to-one relations (subquery → object | null)
  jsonBuildObject,  // Build JSON object from expressions
  mergeAction,      // Get action performed in MERGE query (PostgreSQL 15+)
} from "kysely/helpers/postgres";
```

**Note**: `jsonAgg` is NOT imported - use `eb.fn.jsonAgg()` instead.

### mergeAction (PostgreSQL 15+)

For MERGE queries, get which action was performed:

```typescript
import { mergeAction } from "kysely/helpers/postgres";

const result = await db
  .mergeInto("person")
  .using("person_updates", "person.id", "person_updates.id")
  .whenMatched()
  .thenUpdateSet({ name: eb.ref("person_updates.name") })
  .whenNotMatched()
  .thenInsertValues({ id: eb.ref("person_updates.id"), name: eb.ref("person_updates.name") })
  .returning([mergeAction().as("action"), "id"])
  .execute();

// result[0].action is 'INSERT' | 'UPDATE' | 'DELETE'
```

## Extending Kysely

### Custom Helper Functions

Most extensions use the `sql` template tag with `RawBuilder<T>`:

```typescript
import { sql, RawBuilder } from "kysely";

// Create a typed helper function
function json<T>(value: T): RawBuilder<T> {
  return sql`CAST(${JSON.stringify(value)} AS JSONB)`;
}

// Use in queries
.select((eb) => [
  json({ name: "value" }).as("data"),
])
```

### Custom Expression Classes

For reusable expressions, implement the `Expression<T>` interface:

```typescript
import { Expression, OperationNode, sql } from "kysely";

class JsonValue<T> implements Expression<T> {
  readonly #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  get expressionType(): T | undefined {
    return undefined;
  }

  toOperationNode(): OperationNode {
    return sql`CAST(${JSON.stringify(this.#value)} AS JSONB)`.toOperationNode();
  }
}
```

**Note**: Module augmentation and inheritance-based extension are not recommended.

