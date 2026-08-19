# Implementation Plan: Demiplane ↔ Foundry VTT Sync

## Overview

This plan implements bidirectional character sync between Demiplane Nexus and Foundry VTT for Pathfinder 2e across two TypeScript packages:

1. **`@scooper4711/demiplane-api`** — game-system-agnostic NPM library (authentication, GraphQL, engine utilities)
2. **`foundry-demiplane-pf2e`** — Foundry VTT module (slug mapping, import/export orchestration, UI)

Tasks are ordered so that foundational library work completes before module-level features that depend on it.

## Tasks

- [x] 1. Refactor DemiplaneClient authentication to email/password flow
  - [x] 1.1 Implement email/password authenticate method replacing session-cookie auth
    - Replace `authenticate(sessionCookie)` with `authenticate(email, password)`
    - Exchange credentials for a GraphQL bearer token via Demiplane's auth endpoints
    - Throw validation error if email or password is empty
    - Throw `DemiplaneApiError` with status code and operation name on HTTP failure
    - Throw error on JSON parse failure with operation name
    - Store token internally and attach as Bearer header on subsequent requests
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Allow unauthenticated read-only access
    - Modify `executeGraphql` to send requests without Authorization header when no token is stored
    - Ensure `fetchCharacterVersion`, `fetchCharacterData`, `fetchAttributeMapping` work without prior `authenticate()` call
    - Throw error when `updateCharacter` is called without authentication
    - _Requirements: 1.6, 1.7, 4.7_

  - [x] 1.3 Implement DemiplaneApiError class with structured error properties
    - Create `DemiplaneApiError` extending `Error` with `statusCode`, `operationName`, `requestUrl` properties
    - Use this error type for all HTTP failures in the client
    - _Requirements: 14.1_

  - [x] 1.4 Write unit tests for authentication flow
    - Mock fetch to test successful auth, HTTP failures, JSON parse failures, empty credential rejection
    - Test unauthenticated read access and write rejection
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.7_
    - **Commit**: `feat: Add email/password authentication to DemiplaneClient`
      - Includes tasks 1.1, 1.2, 1.3, 1.4 — auth flow, unauthenticated access, error class, and tests

- [x] 2. Implement fetchCharacterData and validation improvements
  - [x] 2.1 Add fetchCharacterData method to DemiplaneClient
    - Query character by UUID and return complete `engines` array and `engineCacheIdsBySource`
    - Throw error with character UUID when character not found
    - Throw error with joined messages when GraphQL errors array is non-empty
    - Throw error when response is missing engines array
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Add UUID format validation to character methods
    - Validate UUID format (8-4-4-4-12 hex) before sending network requests in `fetchCharacterData`, `fetchCharacterVersion`
    - Throw validation error for invalid UUID format
    - Validate nexus ID is a positive integer in `fetchAttributeMapping`
    - _Requirements: 3.3, 5.4_

  - [x] 2.3 Refine updateCharacter error handling
    - Return `false` on network error or non-200 response instead of throwing
    - Return `false` without sending request if character ID is empty or engines array is missing
    - _Requirements: 4.4, 4.6_

  - [x] 2.4 Write unit tests for character data retrieval and validation
    - Test fetchCharacterData success, not-found, GraphQL errors, invalid structure
    - Test UUID format validation rejection
    - Test updateCharacter error handling returns false
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3, 4.4, 4.6_
    - **Commit**: `feat: Add fetchCharacterData with UUID validation and error handling`
      - Includes tasks 2.1, 2.2, 2.3, 2.4 — character data retrieval, validation, error handling, and tests

- [x] 3. Extend engine utilities with findEnginesByNamePattern
  - [x] 3.1 Add findEnginesByNamePattern function
    - Accept a RegExp pattern and return all Engine_Entry objects whose `name` field matches
    - Return empty array when no entries match
    - _Requirements: 6.5_

  - [x] 3.2 Fix updateCustomEngineValue to return same reference when no match
    - When store name doesn't match any Custom_Engine, return the original array (same reference) instead of a mapped copy
    - _Requirements: 7.4_

  - [x] 3.3 Write property tests for engine utilities (Properties 1, 2, 5, 6, 7, 8)
    - Install fast-check as devDependency
    - **Property 1: Custom engine value update round-trip**
    - **Validates: Requirements 7.5**
    - **Property 2: Immutable engine update preserves non-matching entries**
    - **Validates: Requirements 7.2, 7.3**
    - **Property 5: Engine type guard mutual exclusivity**
    - **Validates: Requirements 6.1, 6.2**
    - **Property 6: findEnginesBySlug returns only exact slug matches**
    - **Validates: Requirements 6.4**
    - **Property 7: findEnginesByNamePattern returns only matching entries**
    - **Validates: Requirements 6.5**
    - **Property 8: Update with non-existent store name returns original array**
    - **Validates: Requirements 7.4**
    - **Commit**: `feat: Add findEnginesByNamePattern and fix no-match reference return`
      - Includes tasks 3.1, 3.2, 3.3 — engine utility enhancements and property tests

- [x] 4. Checkpoint - Ensure all demiplane-api tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Push branch to remote: `git push -u origin feat/demiplane-foundry-sync`

- [x] 5. Implement SlugMapper in the Foundry module
  - [x] 5.1 Create SlugMapper class with slug transformation and compendium resolution
    - Strip trailing `-rm` suffix from slugs when present
    - Pass non-rm slugs unchanged
    - Search compendium packs in defined order: `pf2e.classes`, `pf2e.ancestries`, `pf2e.heritages`, `pf2e.backgrounds`, `pf2e.feats-srd`, `pf2e.spells-srd`, `pf2e.equipment-srd`, `pf2e.classfeatures`
    - Return `ResolvedItem` with uuid, packKey, slug on match
    - Return undefined and log warning on no match
    - Log info when duplicate slug found across packs
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 5.2 Write unit and property tests for SlugMapper (Properties 3, 4)
    - Mock Foundry compendium pack indexes
    - **Property 3: Slug transformation is idempotent on non-rm slugs**
    - **Validates: Requirements 8.2**
    - **Property 4: Slug transformation strips exactly trailing -rm**
    - **Validates: Requirements 8.1**
    - **Commit**: `feat: Add SlugMapper with compendium resolution`
      - Includes tasks 5.1, 5.2 — slug transformation, compendium search, and tests

- [x] 6. Implement CharacterLinkInput utility and module settings
  - [x] 6.1 Create parseCharacterLinkInput function
    - Trim whitespace, extract UUID from full Demiplane URL or accept bare UUID
    - Validate UUID format (8-4-4-4-12 hex, case-insensitive)
    - Return `{ valid: true, uuid }` or `{ valid: false, error }` with expected format description
    - _Requirements: 12.3, 12.4, 12.6, 12.7_

  - [x] 6.2 Update module settings registration
    - Replace session cookie setting with `demiplaneEmail` (string, scope: client) and `demiplanePassword` (password type, scope: client)
    - Keep `autoSync` boolean setting (scope: world)
    - Add `dryRun` boolean setting (scope: world, default: false)
    - _Requirements: 12.1, 12.2, 12.9_
    - **Commit**: `feat: Add module settings for email/password and dry run`
      - Includes task 6.2 — settings registration

  - [x] 6.3 Write unit and property tests for parseCharacterLinkInput (Properties 11, 12, 13)
    - **Property 11: Character link input round-trip for bare UUIDs**
    - **Validates: Requirements 12.3, 12.6**
    - **Property 12: Character link input extracts UUID from valid URL**
    - **Validates: Requirements 12.3, 12.4**
    - **Property 13: Character link input rejects invalid formats**
    - **Validates: Requirements 12.7**
    - **Commit**: `feat: Add parseCharacterLinkInput with URL and UUID parsing`
      - Includes tasks 6.1, 6.3 — link input parser and tests

- [x] 7. Implement ImportOrchestrator
  - [x] 7.1 Create ImportOrchestrator class with full import pipeline
    - Accept DemiplaneClient and SlugMapper as constructor dependencies
    - Fetch character data via client
    - Extract character name and level from Custom_Engines
    - Reconcile existing actor items (remove stale, avoid duplicates)
    - Add ancestry → heritage → background → class sequentially via `createEmbeddedDocuments`
    - Add feats, class features, equipment in batch after class
    - Skip unresolved slugs with warning, continue importing remaining items
    - Set session state values (HP, hero points, focus points, currency) after items added
    - Store version number and timestamp in actor flags
    - Return ImportSummary with itemsImported, itemsSkipped, errors counts
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 14.2, 14.3_

  - [x] 7.4 Write unit tests for ImportOrchestrator
    - Mock DemiplaneClient and Foundry actor API
    - Verify correct ordering of createEmbeddedDocuments calls
    - Test reconciliation logic, unresolved slug handling, dry run mode
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 18.1_
    - **Commit**: `feat: Add ImportOrchestrator with item reconciliation and ordering`
      - Includes tasks 7.1, 7.4 — import pipeline and tests

  - [x] 7.2 Implement attribute boost and skill training import logic
    - Identify engines with name `core/selection/attribute/boost.eng` and extract attribute slugs
    - Identify engines with name `core/selection/skill/increase/index.eng` and extract skill slugs
    - Apply boosts in parentEngine hierarchy/level order
    - Skip boosts/increases already granted by the Grant_Chain
    - Log warning for invalid attribute or skill slugs
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
    - **Commit**: `feat: Add attribute boost and skill training import logic`
      - Includes task 7.2

  - [x] 7.3 Implement dry run mode for import
    - When `dryRun` option is true, run full read pipeline (fetch, slug map, reconciliation) but skip all write operations
    - Return ImportSummary with `preview: true` reflecting what would happen
    - Do not call `createEmbeddedDocuments`, `deleteEmbeddedDocuments`, or modify actor state
    - _Requirements: 18.1, 18.4_
    - **Commit**: `feat: Add dry run mode to ImportOrchestrator`
      - Includes task 7.3

- [x] 8. Implement ExportManager with debounce and rate limiting
  - [x] 8.1 Create ExportManager class with queueChange and flush
    - Accumulate field changes and reset 2-second debounce timer
    - Batch all changes within debounce window into single API call
    - Rate limit to 30 API calls per 60-second rolling window per character
    - Retry up to 3 times with exponential backoff (1s, 2s, 4s) on failure
    - Display ui.notifications.error and retain pending changes after all retries fail
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.8_

  - [x] 8.3 Write unit and property tests for ExportManager (Properties 9, 10)
    - Use fake timers to test debounce collapsing and rate limiting
    - **Property 9: Debounce batching collapses rapid changes**
    - **Validates: Requirements 10.3**
    - **Property 10: Rate limiter never exceeds threshold**
    - **Validates: Requirements 10.4**
    - **Commit**: `feat: Add ExportManager with debounce and rate limiting`
      - Includes tasks 8.1, 8.3 — export manager and tests

  - [x] 8.2 Implement dry run mode for export
    - When `dryRun` option is true, collect pending changes and return in `ExportResult.preview` without calling `updateCharacterV2`
    - Still perform conflict detection so users can see if conflict would occur
    - _Requirements: 18.3, 18.5_
    - **Commit**: `feat: Add dry run mode to ExportManager`
      - Includes task 8.2

- [x] 9. Implement ConflictResolver
  - [x] 9.1 Create ConflictResolver class
    - Fetch remote version via `fetchCharacterVersion` and compare against stored version in actor flags
    - Return `{ conflicted: false }` when versions match
    - Return `{ conflicted: true, localVersion, remoteVersion }` when remote > stored
    - Implement `resolveConflict` with "reimport", "force-push", "cancel" resolution strategies
    - For "reimport": fetch latest data, apply local session state on top, push merged result
    - For "force-push": proceed with update using current local engines
    - For "cancel": abort push, leave both sides unchanged, retain pending changes
    - _Requirements: 10.5, 10.6, 10.7, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 9.2 Write unit tests for ConflictResolver
    - Test version comparison, conflict detection, each resolution strategy
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
    - **Commit**: `feat: Add ConflictResolver with version comparison and strategies`
      - Includes tasks 9.1, 9.2 — conflict resolution and tests

- [x] 10. Checkpoint - Ensure all module core logic tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Push branch to remote: `git push`

- [x] 11. Implement HookManager for session state change detection
  - [x] 11.1 Refactor hooks.ts into HookManager class
    - Accept ExportManager as constructor dependency
    - Register hooks: `updateActor` (HP, temp HP, hero points, focus points), `updateItem` (consumable quantity), `createItem`, `deleteItem`
    - Detect relevant changes and call `exportManager.queueChange` with correct store name and value
    - Only process actors with linked Demiplane character UUID in flags
    - Map currency changes to corresponding store names
    - _Requirements: 10.1, 10.2, 10.9_

  - [x] 11.2 Write unit tests for HookManager
    - Mock ExportManager and verify correct queueChange calls for various actor/item changes
    - Test filtering of non-character actors and unlinked actors
    - _Requirements: 10.1, 10.2_
    - **Commit**: `feat: Add HookManager for session state change detection`
      - Includes tasks 11.1, 11.2 — hook management and tests

- [x] 12. Implement SyncTabRenderer and actor sheet integration
  - [x] 12.1 Create SyncTabRenderer class
    - Render Sync tab only when actor has linked character UUID in flags
    - Display status section: linked UUID, last sync timestamp, local/remote versions
    - Display pending changes list with field name and value
    - Display unresolved slugs from last import
    - Display most recent import summary (labeled "Preview" when from dry run)
    - Display conflict warning with resolution buttons when version mismatch detected
    - Render "Import from Demiplane" / "Push to Demiplane" action buttons
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.11_

  - [x] 12.4 Write unit tests for SyncTabRenderer
    - Test tab renders only for linked actors
    - Test correct display of status, pending changes, issues, summary
    - Test button label changes in dry run mode
    - _Requirements: 15.1, 15.2, 15.12, 15.13_
    - **Commit**: `feat: Add SyncTabRenderer with status and action display`
      - Includes tasks 12.1, 12.4 — sync tab rendering and tests

  - [x] 12.2 Implement dry run UI indicators and dynamic labels
    - Display persistent dry run badge/banner when `dryRun` setting is enabled (distinct from in-progress spinner)
    - Change button labels to "Preview Import" / "Preview Push" when dry run is enabled
    - Update labels immediately on settings change via hook — no page reload needed
    - Disable buttons and show in-progress indicator during operations
    - _Requirements: 15.10, 15.12, 15.13, 18.2, 18.7_
    - **Commit**: `feat: Add dry run UI indicators and dynamic button labels`
      - Includes task 12.2

  - [x] 12.3 Implement per-actor character link dialog
    - Input field accepting bare UUID or full Demiplane character URL
    - Parse input via `parseCharacterLinkInput` on submission
    - Validate extracted UUID format, then fetch character version to confirm accessibility
    - Display ui.notifications.error for invalid format or inaccessible character
    - Store valid UUID in actor flags on success
    - _Requirements: 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_
    - **Commit**: `feat: Add per-actor character link dialog`
      - Includes task 12.3

- [x] 13. Wire components together in module entrypoint
  - [x] 13.1 Update module.ts to instantiate and connect all components
    - Create DemiplaneClient, authenticate from settings on ready
    - Instantiate SlugMapper with pack search order
    - Instantiate ConflictResolver, ExportManager, ImportOrchestrator
    - Instantiate HookManager with ExportManager and register hooks
    - Integrate SyncTabRenderer with actor sheet rendering hook
    - Wire Import/Push buttons to ImportOrchestrator and ExportManager
    - Read `dryRun` setting and pass to operations
    - _Requirements: 12.1, 12.2, 15.8, 15.9, 18.6_

  - [x] 13.2 Write property test for dry run observational guarantee (Property 14)
    - **Property 14: Dry run mode is purely observational**
    - **Validates: Requirements 18.1, 18.3, 18.4, 18.5**
    - Use mock actor and spy on DemiplaneClient to verify no mutations sent
    - **Commit**: `feat: Wire module entrypoint and add dry run property test`
      - Includes tasks 13.1, 13.2 — component wiring and dry run observational guarantee test

- [x] 14. Checkpoint - Ensure all Foundry module tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Push branch to remote: `git push`

- [x] 15. Create documentation
  - [x] 15.1 Write demiplane-api README
    - Package purpose, public API surface, authentication flow
    - Usage examples: authenticate, fetch character, update character, query engines
    - Extension points section for new game-system integrations
    - Architecture section: caller → DemiplaneClient → Demiplane GraphQL API data flow
    - _Requirements: 17.1, 17.2_
    - **Commit**: `docs: Add demiplane-api README with usage examples`

  - [x] 15.2 Add JSDoc comments to all exported symbols in demiplane-api
    - Document all exported functions, classes, interfaces, and type aliases
    - Include description, parameters with types, return value
    - _Requirements: 17.3_
    - **Commit**: `docs: Add JSDoc comments to all exported demiplane-api symbols`

  - [x] 15.3 Write foundry-demiplane-pf2e user README
    - What the module does, installation, configuration (credentials + actor linking), basic usage
    - _Requirements: 17.4_
    - **Commit**: `docs: Add foundry-demiplane-pf2e user README`

  - [x] 15.4 Write docs/ARCHITECTURE.md for Foundry module
    - Data flow diagrams (import and export)
    - Hook lifecycle: which hooks registered, what each handler does, debounce/rate-limit integration
    - Slug_Mapper transformation rules and compendium search order
    - Grant_Chain interaction sequencing
    - _Requirements: 17.5_
    - **Commit**: `docs: Add ARCHITECTURE.md with data flow and hook lifecycle`

  - [x] 15.5 Write docs/DESIGN.md for Foundry module
    - Design decisions and rationale: populate existing actors, 2s debounce, rate-limit threshold, version-based conflict, email/password auth
    - _Requirements: 17.6_
    - **Commit**: `docs: Add DESIGN.md with rationale for key decisions`

  - [x] 15.6 Write docs/CONTRIBUTING.md for Foundry module
    - Dev environment setup, running tests, code style, adding new class support, PR process
    - _Requirements: 17.7_
    - **Commit**: `docs: Add CONTRIBUTING.md with dev setup and PR process`

- [x] 16. Set up Playwright integration test infrastructure
  - [x] 16.1 Create integration test scaffolding with Foundry Node CLI management
    - Configure Foundry VTT Node CLI for programmatic instance start/stop
    - Expose environment variable configuration for Foundry data path, port, admin password
    - Implement world reset mechanism between test runs
    - Abort with clear error if Foundry fails to start
    - _Requirements: 16.1, 16.2, 16.9, 16.10_
    - **Commit**: `test: Add Playwright integration test scaffolding with Foundry CLI`

  - [x] 16.2 Implement Valeros import validation tests (levels 1, 3, 5)
    - Use Playwright to automate import operations via Foundry UI
    - Compare imported actor against Foundry's built-in Valeros reference data
    - Assert ancestry, class, feats, attribute scores, skill proficiencies, equipment, session state values
    - Test levels 1, 3, and 5 for the Fighter class
    - _Requirements: 16.3, 16.4, 16.5, 16.6, 16.7, 16.8_
    - **Commit**: `test: Add Valeros import validation tests for levels 1, 3, 5`

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Push branch to remote: `git push`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The demiplane-api package work (tasks 1–4) must complete before Foundry module tasks that depend on the client API
- fast-check is used as the property-based testing library for both packages
- Both packages use Vitest as the test runner
- Tests live in a parallel `tests/` directory (not colocated with source): `tests/unit/` for unit tests, `tests/property/` for property-based tests, `tests/integration/` for Playwright tests
- **Commit strategy**: implementation + its unit/property tests are committed together as one coherent unit. All commits are signed (`git commit -S`). Push to remote at each checkpoint task (tasks 4, 10, 14, 17) to keep the remote branch current.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "3.1", "3.2"] },
    { "id": 1, "tasks": ["1.2", "1.4", "2.1", "6.1", "6.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.3", "6.3"] },
    { "id": 3, "tasks": ["2.4", "5.1"] },
    { "id": 4, "tasks": ["5.2", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 6, "tasks": ["7.4", "8.2", "9.1"] },
    { "id": 7, "tasks": ["8.3", "9.2", "11.1"] },
    { "id": 8, "tasks": ["11.2", "12.1"] },
    { "id": 9, "tasks": ["12.2", "12.3"] },
    { "id": 10, "tasks": ["12.4", "13.1"] },
    { "id": 11, "tasks": ["13.2"] },
    { "id": 12, "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5", "15.6"] },
    { "id": 13, "tasks": ["16.1"] },
    { "id": 14, "tasks": ["16.2"] }
  ]
}
```
