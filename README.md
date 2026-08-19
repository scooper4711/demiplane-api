# @scooper4711/demiplane-api

A game-system-agnostic TypeScript client for the [Demiplane Nexus](https://app.demiplane.com) character API. Handles authentication, GraphQL queries, engine data parsing, and character updates.

This library is intentionally system-neutral — it knows nothing about specific game systems, compendium packs, or slug conventions. It provides the building blocks for any Demiplane integration.

## Installation

```bash
npm install @scooper4711/demiplane-api
```

Requires Node.js 20 or later.

## Quick Start

```typescript
import {
  DemiplaneClient,
  findCustomEngineByName,
  findEnginesBySlug,
} from "@scooper4711/demiplane-api";

const client = new DemiplaneClient();

// Public characters can be read without authentication
const data = await client.fetchCharacterData(
  "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
);
console.log(`Character has ${data.engines.length} engines`);

// Query engines
const hpEngine = findCustomEngineByName(
  data.engines,
  "character_hit-points_current"
);
console.log(`Current HP: ${hpEngine?.value}`);
```

## Authentication

Authentication is optional for read operations on public characters. It's required for write operations (`updateCharacter`).

```typescript
const client = new DemiplaneClient();

// Authenticate with Demiplane credentials
await client.authenticate("user@example.com", "password");

// The client stores the GraphQL bearer token internally
// and attaches it to all subsequent requests automatically
```

The authentication flow works as follows:

1. The client sends credentials to Demiplane's login endpoint.
2. Demiplane returns a session token.
3. The client exchanges the session token for a GraphQL bearer token.
4. The bearer token is stored internally and sent as an `Authorization: Bearer <token>` header on all subsequent GraphQL requests.

If `authenticate()` is never called, requests are sent without an Authorization header, which allows reading public characters.

## API Reference

### DemiplaneClient

The primary class for interacting with the Demiplane API.

#### `authenticate(email: string, password: string): Promise<void>`

Exchange credentials for a GraphQL bearer token. Throws if credentials are empty, if the HTTP request fails, or if the response cannot be parsed.

```typescript
await client.authenticate("user@example.com", "password");
```

#### `fetchCharacterData(characterId: string): Promise<CharacterData>`

Fetch a character's complete engine data by UUID. Works without authentication for public characters.

```typescript
const data = await client.fetchCharacterData(
  "abc12345-1234-5678-9abc-def012345678"
);
// data.engines — array of all engine entries
// data.engineCacheIdsBySource — metadata for cache management
```

Throws if:

- The UUID format is invalid (must be 8-4-4-4-12 hex)
- The character is not found
- The response is missing the engines array

#### `fetchCharacterVersion(characterId: string): Promise<CharacterVersion>`

Check a character's current version number. Useful for conflict detection before pushing updates.

```typescript
const version = await client.fetchCharacterVersion(
  "abc12345-1234-5678-9abc-def012345678"
);
console.log(`Version: ${version.version}, UUID: ${version.uuid}`);
```

#### `fetchAttributeMapping(nexusId: number): Promise<AttributeMapping>`

Retrieve the attribute mapping for a game system by its nexus ID. Describes which store names are user-settable.

```typescript
const mapping = await client.fetchAttributeMapping(28); // 28 = Pathfinder 2e
// mapping.attributeMapping["character_hit-points_current"].set === true
```

#### `updateCharacter(options: UpdateCharacterOptions): Promise<boolean>`

Push updated character data back to Demiplane. Requires prior authentication.

Returns `true` on success, `false` on failure (network error, non-200 response, or mutation failure). Does not throw on write failures — this makes error handling simpler for callers.

```typescript
const success = await client.updateCharacter({
  id: "abc12345-1234-5678-9abc-def012345678",
  data: updatedCharacterData,
  name: "Valeros",
  level: 5,
  classSlug: "fighter",
});
```

Optional fields (`name`, `level`, `classSlug`, `avatarUrl`, `viewPermission`, `editPermission`) are included in the mutation only when provided.

### Engine Utilities

Pure functions for querying and transforming the engines array. These are the primary way to work with character data.

#### Type Guards

```typescript
import { isCustomEngine, isDemiplaneEngine } from "@scooper4711/demiplane-api";

for (const engine of data.engines) {
  if (isCustomEngine(engine)) {
    // engine is CustomEngine — has .value (string | number | boolean)
  }
  if (isDemiplaneEngine(engine)) {
    // engine is DemiplaneEngine — has .args.slug, .args.id, etc.
  }
}
```

These are mutually exclusive: every engine is exactly one type.

#### `findCustomEngineByName(engines, storeName): CustomEngine | undefined`

Find a custom engine by its store name. Returns `undefined` if no match.

```typescript
const hp = findCustomEngineByName(data.engines, "character_hit-points_current");
const heroPoints = findCustomEngineByName(
  data.engines,
  "character_hero-points"
);
```

#### `findEnginesBySlug(engines, slug): DemiplaneEngine[]`

Find all DemiplaneEngine entries with an exact `args.slug` match.

```typescript
const fighterEngines = findEnginesBySlug(data.engines, "fighter");
```

#### `findEnginesByNamePattern(engines, pattern): CharacterEngine[]`

Find engines whose `name` field matches a regular expression.

```typescript
// Find all spell engines
const spells = findEnginesByNamePattern(data.engines, /^tabula\/spell\//);

// Find all boost engines
const boosts = findEnginesByNamePattern(data.engines, /attribute\/boost/);
```

#### `findSpellEngines(engines): DemiplaneEngine[]`

Find all engines with names starting with `tabula/spell/`.

#### `findSpellbookSpells(engines): DemiplaneEngine[]`

Find spell engines that are base spellbook spells.

#### `findPreparedSpells(engines): DemiplaneEngine[]`

Find spell engines marked as prepared.

#### `isCurriculumSpell(engine): boolean`

Check if a spell engine is a wizard school curriculum spell.

#### `updateCustomEngineValue(engines, storeName, value): CharacterEngine[]`

Immutably update a custom engine's value. Returns a new array with the matching engine replaced. Non-matching engines are preserved by reference (not cloned). If the store name doesn't exist, returns the original array (same reference).

```typescript
import { updateCustomEngineValue } from "@scooper4711/demiplane-api";

// Set current HP to 42
const updated = updateCustomEngineValue(
  data.engines,
  "character_hit-points_current",
  42
);

// Push the change
await client.updateCharacter({
  id: characterId,
  data: { ...data, engines: updated },
});
```

### Error Handling

#### DemiplaneApiError

Thrown on HTTP failures. Contains structured information for programmatic handling.

```typescript
import { DemiplaneApiError } from "@scooper4711/demiplane-api";

try {
  await client.authenticate("user@example.com", "wrong-password");
} catch (error) {
  if (error instanceof DemiplaneApiError) {
    console.log(error.statusCode); // e.g. 401
    console.log(error.operationName); // "authentication request"
    console.log(error.requestUrl); // the URL that failed
  }
}
```

#### Error Behavior Summary

| Operation               | Error Condition          | Behavior                   |
| ----------------------- | ------------------------ | -------------------------- |
| `authenticate`          | Empty email/password     | Throws `Error`             |
| `authenticate`          | HTTP failure             | Throws `DemiplaneApiError` |
| `fetchCharacterData`    | Invalid UUID             | Throws `Error`             |
| `fetchCharacterData`    | Not found                | Throws `Error`             |
| `fetchAttributeMapping` | Invalid nexus ID         | Throws `Error`             |
| `updateCharacter`       | Not authenticated        | Throws `Error`             |
| `updateCharacter`       | Network/HTTP failure     | Returns `false`            |
| `updateCharacter`       | Mutation returns failure | Returns `false`            |

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────────────┐
│   Your Code     │────────▶│  DemiplaneClient │────────▶│  Demiplane GraphQL API  │
│  (caller)       │◀────────│                  │◀────────│  (apiv4.demiplane.com)  │
└─────────────────┘         └──────────────────┘         └─────────────────────────┘
                                     │
                                     │ uses
                                     ▼
                            ┌──────────────────┐
                            │ Engine Utilities  │
                            │ (pure functions) │
                            └──────────────────┘
```

### Data Flow

1. **Caller** invokes `DemiplaneClient` methods with character UUIDs or update payloads.
2. **DemiplaneClient** constructs GraphQL queries/mutations, attaches the bearer token (if authenticated), and sends requests to `https://apiv4.demiplane.com/v1/graphql`.
3. **Demiplane GraphQL API** returns character data as JSON containing the `engines` array.
4. **Engine Utilities** provide pure functions to query, filter, and immutably transform the engines array without any network calls.

### Token Management

The client manages authentication state internally:

- A single `graphqlToken` field stores the bearer token after successful authentication.
- The token is attached to every GraphQL request when present.
- There is no token refresh or expiry handling — if the token expires, the caller must re-authenticate.
- The client has no persistent storage. Tokens live only in memory for the duration of the client instance.

### Character Data Model

Characters in Demiplane are represented as an array of "engines" — each engine is either a **DemiplaneEngine** (referencing a game rule like a class or feat) or a **CustomEngine** (storing a user-editable value like current HP).

```typescript
// DemiplaneEngine — references game rules
{
  type: "DemiplaneEngine",
  name: "tabula/spell/fireball-rm.eng",
  args: { slug: "fireball-rm", id: "..." }
}

// CustomEngine — stores session state
{
  type: "CustomDemiplaneEngine",
  name: "character_hit-points_current",
  value: 42
}
```

## Extension Points

This library is designed to be consumed by game-system-specific integrations. It handles the Demiplane communication layer while leaving all game-specific logic to the consumer.

### Building an Integration for Another Game System

To build a sync integration for a different Demiplane-supported game system (D&D 5e, Marvel Multiverse, etc.), you would:

1. **Use `DemiplaneClient`** for all API communication — authentication, fetching character data, pushing updates. This works identically regardless of game system.

2. **Build your own slug mapper** that translates Demiplane engine slugs into your target system's item identifiers. Each game system has its own slug conventions.

3. **Build your own actor/character translator** that reads the engines array and populates your target system's data model. The engine utilities (`findEnginesBySlug`, `findEnginesByNamePattern`, `findCustomEngineByName`) help you query the data without worrying about the raw structure.

4. **Use `updateCustomEngineValue`** to modify session state values before pushing them back to Demiplane.

### Example: Hypothetical D&D 5e Integration

```typescript
import {
  DemiplaneClient,
  findEnginesBySlug,
  findCustomEngineByName,
  findEnginesByNamePattern,
  updateCustomEngineValue,
} from "@scooper4711/demiplane-api";

const client = new DemiplaneClient();
const data = await client.fetchCharacterData(characterUuid);

// Your game-specific slug mapping
const classEngines = findEnginesBySlug(data.engines, "wizard");

// Your game-specific session state store names
const currentHp = findCustomEngineByName(
  data.engines,
  "character_hit-points_current"
);

// Your game-specific translation logic
// translateToFoundry5e(data.engines, actor);
// translateToRoll20(data.engines, sheet);
// translateToOwlbear(data.engines, character);
```

### What This Library Provides vs. What You Build

| This library provides               | You build                                 |
| ----------------------------------- | ----------------------------------------- |
| Authentication and token management | Credential storage/UI for your platform   |
| GraphQL communication               | —                                         |
| Engine array querying and filtering | Slug mapping for your game system         |
| Immutable engine value updates      | Actor/character population logic          |
| Character version checking          | Conflict resolution UI                    |
| Attribute mapping retrieval         | Platform-specific session state detection |

## Types

All types are exported for use in your integration:

```typescript
import type {
  DemiplaneAuthTokens,
  CharacterEngine,
  CustomEngine,
  DemiplaneEngine,
  CharacterData,
  CharacterVersion,
  AttributeMapping,
} from "@scooper4711/demiplane-api";
```

## Common Session State Store Names (PF2e)

These store names are used in Pathfinder 2e characters for session state values:

| Store Name                     | Type   | Description          |
| ------------------------------ | ------ | -------------------- |
| `character_hit-points_current` | number | Current HP           |
| `character_hit-points_temp`    | number | Temporary HP         |
| `character_hero-points`        | number | Hero points          |
| `character_focus_current`      | number | Current focus points |
| `character_currency_gold`      | number | Gold pieces          |
| `character_currency_silver`    | number | Silver pieces        |
| `character_currency_copper`    | number | Copper pieces        |
| `character_currency_platinum`  | number | Platinum pieces      |

Other game systems will have their own store names — use `fetchAttributeMapping` to discover them programmatically.

## License

MIT
