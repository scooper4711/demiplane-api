# Requirements Document

## Introduction

This feature delivers two-way sync between Demiplane Nexus and Foundry VTT for Pathfinder 2e characters, split across two packages:

1. **`demiplane-api` (NPM library)** — A reusable, game-system-agnostic TypeScript client for authenticating with Demiplane, querying characters via GraphQL, parsing engine data, and pushing updates back. Other developers can use this library to build integrations for any Demiplane-supported game system.

2. **`foundry-demiplane-pf2e` (Foundry VTT module)** — A Foundry VTT module that uses the NPM library to perform bidirectional sync between Demiplane characters and Foundry PF2e actors. Demiplane is the source of truth for character building; Foundry tracks session state (HP, currency, consumables, spell slots used).

## Glossary

- **Demiplane_Client**: The TypeScript API client that handles authentication and GraphQL communication with Demiplane's backend services.
- **Engine_Entry**: A single JSON object in a character's `engines` array representing either a game-rule reference (DemiplaneEngine) or a user-set value (CustomDemiplaneEngine).
- **Custom_Engine**: An Engine_Entry of type "CustomDemiplaneEngine" storing a user-editable value such as current HP or currency.
- **Demiplane_Engine**: An Engine_Entry of type "DemiplaneEngine" referencing a game-rule definition such as a class, feat, spell, or item.
- **Character_Data**: The complete JSON structure sent to and received from Demiplane, containing the `engines` array and `engineCacheIdsBySource` metadata.
- **Session_State**: Mutable values that change during play — HP, temporary HP, hero points, focus points, currency, consumable quantities, and spell slots used.
- **Character_Build**: The structural choices defining a character — class, ancestry, heritage, background, feats, spells known, skill training, and attribute boosts.
- **Slug_Mapper**: A component within the Sync_Module that translates between Demiplane PF2e engine slugs (e.g., "fireball-rm" for Remastered content) and Foundry PF2e compendium slugs (e.g., "fireball"). This is Foundry-module-specific logic with no dependency on the generic Demiplane_Client library.
- **Sync_Module**: The Foundry VTT module (`foundry-demiplane-pf2e`) responsible for orchestrating import and export between the two systems.
- **Grant_Chain**: The PF2e system's GrantItem rule engine that automatically adds related features when a parent item (class, ancestry, feat) is added to an actor.
- **Version_Number**: An integer on each Demiplane character that increments with every save, used for conflict detection.
- **Attribute_Mapping**: A Demiplane-provided lookup that maps store names to display attributes, indicating which values are user-settable.

## Requirements

### Requirement 1: Demiplane Authentication (Optional)

**User Story:** As a developer using the library, I want to optionally authenticate with Demiplane's API using an email and password, so that I can access private characters and perform write operations while still being able to query public characters without credentials.

#### Acceptance Criteria

1. WHEN a valid email and password are provided to the authenticate method, THE Demiplane_Client SHALL exchange the credentials for a GraphQL bearer token by sending appropriate requests to Demiplane's authentication endpoints internally.
2. WHEN the authentication request returns a non-200 HTTP status, THE Demiplane_Client SHALL throw an error containing the HTTP status code and the operation name "authentication request".
3. WHEN the authentication response body cannot be parsed as valid JSON, THE Demiplane_Client SHALL throw an error indicating the parse failure and include the operation name.
4. WHEN the provided email is empty or the provided password is empty, THE Demiplane_Client SHALL throw a validation error indicating that both email and password are required.
5. WHEN authentication has been performed successfully, THE Demiplane_Client SHALL store the obtained GraphQL bearer token internally and attach it as an Authorization header with the "Bearer" scheme on all subsequent GraphQL requests.
6. WHEN no authentication has been performed, THE Demiplane_Client SHALL send GraphQL requests without an Authorization header, allowing access to publicly accessible characters.
7. THE Demiplane_Client SHALL be usable for read operations (character retrieval, version checks, attribute mapping retrieval) without calling the authenticate method first.

### Requirement 2: Character Data Retrieval

**User Story:** As a developer using the library, I want to fetch a character's full data by UUID, so that I can read the character's build and session state.

#### Acceptance Criteria

1. WHEN a valid character UUID is provided, THE Demiplane_Client SHALL return the character's complete engines array (containing all Engine_Entry objects) and the engineCacheIdsBySource metadata object.
2. WHEN the character UUID does not match any existing character (the GraphQL response data is null or empty), THE Demiplane_Client SHALL throw an error whose message includes the character UUID that was not found.
3. WHEN the GraphQL response contains an errors array with one or more entries, THE Demiplane_Client SHALL throw an error whose message contains all GraphQL error messages joined with "; " as separator.
4. WHEN the GraphQL response succeeds but the data field is missing the engines array, THE Demiplane_Client SHALL throw an error indicating the response structure is invalid.

### Requirement 3: Character Version Retrieval

**User Story:** As a developer using the library, I want to check a character's current version number, so that I can detect whether the character was modified since my last fetch.

#### Acceptance Criteria

1. WHEN a valid character UUID is provided, THE Demiplane_Client SHALL return an object containing the character's UUID as a string and the current version as a non-negative integer.
2. WHEN the character UUID does not match any existing character (the GraphQL response data is null or empty), THE Demiplane_Client SHALL throw an error whose message includes the character UUID that was not found.
3. WHEN the provided string is not a valid UUID format, THE Demiplane_Client SHALL throw a validation error before sending any network request.

### Requirement 4: Character Data Update

**User Story:** As a developer using the library, I want to push updated character data back to Demiplane, so that session state changes are persisted.

#### Acceptance Criteria

1. WHEN valid Character_Data and a non-empty character ID string are provided, THE Demiplane_Client SHALL send the full engines array and engineCacheIdsBySource as the $data field to Demiplane via the updateCharacterV2 mutation.
2. WHEN the updateCharacterV2 mutation response contains a success field equal to true, THE Demiplane_Client SHALL return true.
3. IF the updateCharacterV2 mutation response contains a success field equal to false, THEN THE Demiplane_Client SHALL return false.
4. IF the GraphQL request fails due to a network error or non-200 response before a mutation result is received, THEN THE Demiplane_Client SHALL return false without throwing an exception.
5. THE Demiplane_Client SHALL accept optional metadata fields (name as string, level as integer between 1 and 20, classSlug as string, avatarUrl as string, viewPermission as integer, editPermission as integer) alongside the Character_Data, and include only the provided optional fields in the mutation variables.
6. IF the character ID is empty or the Character_Data engines array is missing, THEN THE Demiplane_Client SHALL return false without sending a network request.
7. IF the Demiplane_Client has not been authenticated via the authenticate method, THEN THE Demiplane_Client SHALL throw an error indicating that authentication is required for write operations.

### Requirement 5: Attribute Mapping Retrieval

**User Story:** As a developer using the library, I want to retrieve the attribute mapping for a game system, so that I can determine which character values are user-settable.

#### Acceptance Criteria

1. WHEN a valid nexus ID is provided, THE Demiplane_Client SHALL return the complete attribute mapping as an array of entries, each containing store_name, description, data_type, set flag, token_bar_enabled flag, and max_store_name.
2. WHEN no attribute mapping exists for the given nexus ID (the GraphQL response returns an empty array), THE Demiplane_Client SHALL throw an error indicating that no attribute mapping was found for the specified nexus ID.
3. FOR ALL entries in the returned mapping, THE Demiplane_Client SHALL represent data_type as either "number" or "string", set as a boolean indicating whether the value is writable from outside, token_bar_enabled as a boolean, and max_store_name as an optional string field that is present only for attributes that have a maximum value.
4. IF the provided nexus ID is not a positive integer, THEN THE Demiplane_Client SHALL throw a validation error indicating the invalid nexus ID.

### Requirement 6: Engine Entry Parsing and Querying

**User Story:** As a developer using the library, I want to query and filter engine entries by type, name, and slug, so that I can extract specific character data without traversing the raw array manually.

#### Acceptance Criteria

1. THE Demiplane_Client library SHALL provide an isCustomEngine function that returns true when an Engine_Entry has type equal to "CustomDemiplaneEngine" and false otherwise.
2. THE Demiplane_Client library SHALL provide an isDemiplaneEngine function that returns true when an Engine_Entry has type equal to "DemiplaneEngine" and false otherwise.
3. WHEN a store name string is provided, THE Demiplane_Client library SHALL return the first Custom_Engine whose name field exactly matches the store name, or undefined if no match exists in the engines array.
4. WHEN a slug string is provided, THE Demiplane_Client library SHALL return an array of all Demiplane_Engine entries whose args.slug field exactly matches the given slug (case-sensitive), returning an empty array when no entries match.
5. WHEN a name pattern (regular expression) is provided, THE Demiplane_Client library SHALL return an array of all Engine_Entry objects whose name field matches the pattern, returning an empty array when no entries match.

### Requirement 7: Custom Engine Value Updates

**User Story:** As a developer using the library, I want to update Custom_Engine values immutably, so that I can modify session state values (HP, currency, hero points) without mutating the original array.

#### Acceptance Criteria

1. WHEN a store name and new numeric value are provided, THE Demiplane_Client library SHALL return a new engines array with the matching Custom_Engine's value field set to the new value, where matching is determined by the Custom_Engine's name field equaling the provided store name.
2. THE Demiplane_Client library SHALL preserve referential equality for all non-matching Engine_Entry objects in the returned array (the original objects are reused, not cloned).
3. THE Demiplane_Client library SHALL not mutate the original engines array or any of its contained objects.
4. WHEN the provided store name does not match any Custom_Engine in the array, THE Demiplane_Client library SHALL return the original array unchanged.
5. FOR ALL valid engines arrays, updating a Custom_Engine value and then querying for that store name SHALL return the new value (round-trip property).

### Requirement 8: Slug Mapping (Foundry Module)

**User Story:** As a Foundry GM or player using the PF2e sync module, I want Demiplane engine slugs to be translated into Foundry PF2e compendium slugs during import, so that character choices from Demiplane resolve to the correct compendium items in Foundry.

#### Acceptance Criteria

1. WHEN a Demiplane slug ends with the suffix "-rm" (indicating Pathfinder 2e Remastered content), THE Sync_Module SHALL strip exactly the trailing "-rm" to produce the corresponding Foundry PF2e compendium slug.
2. WHEN a Demiplane slug does not end with "-rm", THE Sync_Module SHALL pass the slug unchanged as the Foundry PF2e compendium slug.
3. WHEN a derived Foundry slug is produced, THE Sync_Module SHALL search the indexed Foundry compendium packs (pf2e.classes, pf2e.ancestries, pf2e.heritages, pf2e.backgrounds, pf2e.feats-srd, pf2e.spells-srd, pf2e.equipment-srd, pf2e.classfeatures) for a matching item where system.slug equals the derived slug exactly.
4. WHEN multiple compendium items share the same system.slug, THE Sync_Module SHALL return the first match found in pack search order and log an info-level message identifying the duplicate slug and chosen pack.
5. WHEN no compendium item matches the derived slug across all searched packs, THE Sync_Module SHALL return undefined and log a warning identifying the original Demiplane slug, the derived Foundry slug, and the list of packs that were searched.
6. THE Sync_Module SHALL encapsulate all slug transformation and compendium resolution logic within the Foundry module; the Demiplane_Client library SHALL have no knowledge of game-system-specific slug conventions or compendium lookups.

### Requirement 9: Character Import (Demiplane to Foundry)

**User Story:** As a Foundry player with ownership of an existing actor, I want to populate that actor with my Demiplane character data, so that I can use my character in a Foundry game session without manual data entry.

#### Acceptance Criteria

1. WHEN a player triggers import on an actor that has a linked character UUID and valid authentication is available, THE Sync_Module SHALL fetch the character data from Demiplane and populate the existing actor with the character's name and level.
2. IF the Demiplane API request fails or returns a non-success response, THEN THE Sync_Module SHALL abort the import, preserve the existing actor state unchanged, and return an error indication specifying the failure reason.
3. THE Sync_Module SHALL add the character's ancestry, heritage, background, and class via Foundry's createEmbeddedDocuments method in the order ancestry → heritage → background → class, waiting for each createEmbeddedDocuments call to complete before issuing the next, to trigger the Grant_Chain correctly.
4. THE Sync_Module SHALL resolve each Demiplane engine slug to a Foundry compendium item UUID using the Slug_Mapper before adding items to the actor.
5. WHEN a Demiplane slug cannot be resolved to a Foundry compendium item, THE Sync_Module SHALL skip that item, log a warning that includes the unresolved slug name, and continue importing the remaining items.
6. THE Sync_Module SHALL add feats and equipment only after the class and ancestry createEmbeddedDocuments calls have completed, so that Grant_Chain prerequisites are satisfied.
7. THE Sync_Module SHALL set Session_State values (current HP, hero points, focus points, and currency) on the actor after all items have been added.
8. WHEN the actor already contains items from a previous import, THE Sync_Module SHALL reconcile the differences by removing items no longer present in the Demiplane character and adding newly present items, rather than duplicating existing entries.

### Requirement 10: Session State Export (Foundry to Demiplane)

**User Story:** As a Foundry GM or player, I want session state changes made during play to sync back to Demiplane, so that my character sheet on Demiplane reflects what happened in the Foundry session.

#### Acceptance Criteria

1. WHEN a linked actor's HP, temporary HP, hero points, or focus points change via an updateActor hook, THE Sync_Module SHALL update the corresponding Custom_Engine values (character_hit-points_current, character_hit-points_temp, character_hero-points, character_focus_current) in the character's engines array.
2. WHEN a linked actor's currency (gold, silver, copper, platinum) changes in Foundry, THE Sync_Module SHALL update the corresponding Custom_Engine values (character_currency_gold, character_currency_silver, character_currency_copper, character_currency_platinum).
3. THE Sync_Module SHALL debounce changes within a 2-second window, batching all updates that occur within that window into a single Demiplane API call.
4. THE Sync_Module SHALL not exceed 30 API calls to Demiplane per 60-second rolling window per character.
5. WHEN pushing changes to Demiplane, THE Sync_Module SHALL first fetch the current character version and compare it to the locally stored last-known version.
6. IF the remote character version is greater than the locally stored version, THEN THE Sync_Module SHALL warn the user of a conflict and present options to re-import or force-push.
7. WHEN the updateCharacterV2 mutation succeeds, THE Sync_Module SHALL update the locally stored version number from the mutation response.
8. WHEN the updateCharacterV2 mutation fails, THE Sync_Module SHALL retry up to 3 times with exponential backoff starting at 1 second, and if all retries fail, display a user-visible notification with the failure reason and retain the pending changes.
9. WHILE changes are pending sync to Demiplane, THE Sync_Module SHALL display a visual indicator on the actor sheet showing unsynchronized changes exist.

### Requirement 11: Conflict Detection

**User Story:** As a user, I want the system to detect when someone else has modified my character on Demiplane since my last sync, so that neither side's changes are silently overwritten.

#### Acceptance Criteria

1. THE Sync_Module SHALL store the character's version number in the actor's flags immediately after each successful fetch or push operation.
2. WHEN initiating a push to Demiplane, THE Sync_Module SHALL fetch the current remote version via the character_version query and compare it against the stored version.
3. IF the remote version is greater than the stored version, THEN THE Sync_Module SHALL present a conflict notification to the user with exactly three options: "Re-import" (fetch latest and re-apply session state), "Force push" (overwrite remote with local), and "Cancel" (abort the push and leave both sides unchanged).
4. IF the user chooses "Force push", THEN THE Sync_Module SHALL proceed with the update using the current local engines array.
5. IF the user chooses "Re-import", THEN THE Sync_Module SHALL fetch the latest character data from Demiplane, apply the Foundry actor's current session state values (HP, temp HP, hero points, focus points, currency) on top of the fresh engines array, and push the merged result.
6. IF the user chooses "Cancel", THEN THE Sync_Module SHALL abort the push, leave the Demiplane character unchanged, and retain the pending local changes for the next sync attempt.

### Requirement 12: Foundry Module Configuration

**User Story:** As a Foundry user, I want to configure the sync module with my Demiplane credentials and link specific actors to Demiplane characters using a UUID or a full Demiplane character URL, so that the module knows which characters to sync.

#### Acceptance Criteria

1. THE Sync_Module SHALL register module settings via game.settings.register() where users can enter their Demiplane email as a string value and their password as a password-type (secret) string value, both stored with scope "client" so each user has their own credentials.
2. THE Sync_Module SHALL treat the email and password settings as optional — users who only sync publicly accessible characters are not required to provide credentials.
3. THE Sync_Module SHALL provide a per-actor configuration dialog where users can enter either a bare Demiplane character UUID in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12 hex characters) or a full Demiplane character URL in the format https://app.demiplane.com/nexus/pathfinder2e/character-sheet/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.
4. WHEN a user submits a full Demiplane character URL, THE Sync_Module SHALL extract the UUID by stripping the URL prefix and use the extracted UUID for all subsequent operations.
5. WHEN a character UUID is linked to an actor, THE Sync_Module SHALL store this association in the actor's flags via actor.setFlag("foundry-demiplane-pf2e", "characterId", uuid).
6. WHEN a user submits a character UUID or URL to link, THE Sync_Module SHALL validate the extracted UUID format client-side and then fetch the character version from Demiplane to confirm the UUID is valid and accessible.
7. IF the input is neither a valid UUID nor a recognized Demiplane character URL, THEN THE Sync_Module SHALL display an error notification via ui.notifications.error indicating the expected formats.
8. IF the extracted UUID fails format validation or the Demiplane API returns an error when fetching the version, THEN THE Sync_Module SHALL display an error notification via ui.notifications.error and not persist the link in actor flags.
9. THE Sync_Module SHALL register a "Dry Run" module setting via game.settings.register() as a boolean value with scope "world", defaulting to false, so that GMs can enable or disable dry run mode for all users in the world.

### Requirement 13: Attribute Boost and Skill Training Import

**User Story:** As a Foundry user, I want my character's attribute boosts and trained skills to be correctly applied during import, so that my ability scores and skill modifiers are accurate.

#### Acceptance Criteria

1. WHEN importing attribute boosts, THE Sync_Module SHALL identify all Engine_Entry objects whose name equals "core/selection/attribute/boost.eng" and extract the attribute slug from each entry's args.slug field.
2. THE Sync_Module SHALL apply each attribute boost to the Foundry actor in the order determined by the engine entry's parentEngine hierarchy and level progression.
3. WHEN importing skill training, THE Sync_Module SHALL identify all Engine_Entry objects whose name equals "core/selection/skill/increase/index.eng" and extract the skill slug from each entry's args.slug field.
4. THE Sync_Module SHALL compare the extracted attribute boosts and skill increases against items already present on the actor (granted by ancestry, background, or class via the Grant_Chain) and SHALL skip any boost or increase that duplicates one already applied by a granted item.
5. WHEN an attribute slug or skill slug extracted from a Demiplane engine does not correspond to a valid Foundry PF2e attribute or skill identifier, THE Sync_Module SHALL log a warning identifying the invalid slug and continue processing remaining entries.

### Requirement 14: Error Reporting and Logging

**User Story:** As a developer or user, I want clear error messages and operation logs, so that I can diagnose sync failures and mapping issues.

#### Acceptance Criteria

1. WHEN a network request to Demiplane fails, THE Demiplane_Client SHALL throw an Error subclass that includes properties for the HTTP status code (as number), the operation name (as string), and the request URL (as string).
2. WHEN a slug mapping fails during import, THE Sync_Module SHALL log a warning to the browser console that includes the original Demiplane slug, the derived Foundry slug, and the array of compendium pack keys that were searched.
3. THE Sync_Module SHALL produce an import summary object after each import operation containing three counts: itemsImported (number of items successfully added), itemsSkipped (number of items skipped due to mapping failures), and errors (array of error message strings for items that failed during addition).
4. THE Sync_Module SHALL display the import summary to the user via a Foundry dialog listing successes, skipped items, and errors.
5. WHEN an export to Demiplane fails after all retry attempts are exhausted, THE Sync_Module SHALL display a user-visible notification via ui.notifications.error with the failure reason and SHALL retain the pending changes in memory for the next sync attempt.

### Requirement 15: Actor Sheet Sync Tab

**User Story:** As a Foundry user with a linked Demiplane character, I want a dedicated sync tab on my actor sheet, so that I can view sync status, pending changes, unresolved issues, and trigger manual sync operations from a single location.

#### Acceptance Criteria

1. WHEN an actor has a linked Demiplane character UUID stored in its flags (per Requirement 12), THE Sync_Module SHALL render an additional "Sync" tab on the actor sheet.
2. WHEN an actor does not have a linked Demiplane character UUID, THE Sync_Module SHALL not render the Sync tab on the actor sheet.
3. THE Sync_Module SHALL display the linked character UUID, the timestamp of the last successful sync operation (import or export), the locally stored version number, and the last known remote version number within the Sync tab status section.
4. WHILE changes are pending sync to Demiplane, THE Sync_Module SHALL display a list of pending changes in the Sync tab, where each entry identifies the field name that changed and the new value.
5. WHEN slug mapping failures occurred during the most recent import, THE Sync_Module SHALL display the unresolved slugs in the Sync tab issues section, where each entry shows the original Demiplane slug and the derived Foundry slug that failed to resolve.
6. IF a version conflict has been detected (remote version greater than stored version), THEN THE Sync_Module SHALL display a conflict warning in the Sync tab indicating the local version, the remote version, and the three resolution options (Re-import, Force push, Cancel) as actionable controls.
7. THE Sync_Module SHALL display the most recent import summary in the Sync tab, showing the count of items imported, items skipped, and the list of error messages.
8. THE Sync_Module SHALL render a "Import from Demiplane" button in the Sync tab that, when clicked, triggers a full character import operation identical to the manual import described in Requirement 9.
9. THE Sync_Module SHALL render a "Push to Demiplane" button in the Sync tab that, when clicked, triggers an immediate export of pending session state changes identical to the export described in Requirement 10.
10. WHEN sync operations are in progress (import or export), THE Sync_Module SHALL disable the Import and Push buttons and display an in-progress indicator until the operation completes or fails.
11. THE Sync_Module SHALL replace the visual indicator described in Requirement 10 acceptance criterion 9 with the Sync tab's pending changes display as the canonical location for showing unsynchronized state.
12. WHILE the "Dry Run" module setting is enabled, THE Sync_Module SHALL display a persistent visual indicator in the Sync tab (distinct from the in-progress indicator) clearly communicating that dry run mode is active and no changes will be written to either system.
13. WHILE the "Dry Run" module setting is enabled, THE Sync_Module SHALL change the "Import from Demiplane" button label to "Preview Import" and the "Push to Demiplane" button label to "Preview Push".

### Requirement 16: Playwright Integration Testing

**User Story:** As a developer, I want automated integration tests using Playwright against a real Foundry instance that validate the import produces an actor matching Foundry's built-in Valeros at levels 1, 3, and 5, so that I can verify the sync works correctly end-to-end.

#### Acceptance Criteria

1. THE test infrastructure SHALL use the Foundry VTT Node CLI to programmatically start a Foundry VTT instance before the test suite runs and stop it after the suite completes.
2. THE test infrastructure SHALL provide a mechanism to reset the test world to a clean state between individual test runs, ensuring no leftover actor data from a previous test affects subsequent tests.
3. WHEN the test suite executes, THE test runner SHALL use Playwright to automate the Foundry VTT browser UI for triggering import operations and validating resulting actor state.
4. THE test suite SHALL use the Valeros (Fighter Iconic) character as the validation fixture, available from both Demiplane (as a character UUID) and Foundry's pre-built PF2e data (as a reference actor).
5. THE test suite SHALL validate the import at three character levels: level 1, level 3, and level 5, using the corresponding Valeros build from Demiplane at each level.
6. WHEN a Valeros import test executes, THE test runner SHALL import the Demiplane Valeros character into a fresh Foundry actor and compare the resulting actor against Foundry's built-in Valeros reference data for that level.
7. THE test assertions SHALL validate that the imported actor matches the reference actor in ancestry, class, feats, attribute scores, skill proficiencies, equipment, and session state values (HP, hero points, focus points, currency).
8. THE test suite SHALL use the Fighter class exclusively because it has no spells or class-specific edge cases relevant to this specification; class-specific testing for spellcasters is deferred to future per-class specs.
9. IF the Foundry Node CLI fails to start or the Foundry instance becomes unresponsive, THEN THE test infrastructure SHALL abort the test suite with a clear error message identifying the startup or connectivity failure.
10. THE test infrastructure SHALL expose configuration for the Foundry data path, port, and admin password so that the test environment can be adapted to different developer machines without code changes.

### Requirement 17: Architecture Documentation

**User Story:** As a developer (either the author or a community contributor), I want comprehensive documentation for both packages, so that I can understand the system design, data flow, extension points, and contribution process without reading every source file.

#### Acceptance Criteria

1. THE Demiplane_Client library SHALL include a README file that describes the package's purpose, public API surface, authentication flow, usage examples for common operations (authenticate, fetch character, update character, query engines), and a section describing extension points for developers building new game-system integrations with their own slug mapping and actor translation logic.
2. THE Demiplane_Client library SHALL include an architecture section in its README that describes the data flow from caller → Demiplane_Client → Demiplane GraphQL API and back, including how authentication tokens are managed.
3. THE Demiplane_Client library SHALL have JSDoc comments on all exported functions, classes, interfaces, and type aliases, where each JSDoc comment includes a description of the symbol's purpose, its parameters with types and descriptions, and its return value.
4. THE Sync_Module SHALL include a user-focused README file that describes what the module does, how to install it, how to configure it (Demiplane credentials and actor linking), and basic usage instructions for importing and exporting characters.
5. THE Sync_Module SHALL include a docs/ARCHITECTURE.md file that describes the data flow from Demiplane API → Demiplane_Client → Sync_Module → Foundry Actor and the reverse flow for session state export, the Foundry hook lifecycle (which hooks are registered, what each hook handler does, and how the debounce and rate-limit mechanisms integrate with hook processing), the Slug_Mapper's transformation rules and compendium search order, and the Grant_Chain interaction sequencing.
6. THE Sync_Module SHALL include a docs/DESIGN.md file that documents design decisions and their rationale, tradeoffs considered, and why specific approaches were chosen (such as populating existing actors rather than creating new ones, the 2-second debounce window, and the rate-limit threshold).
7. THE Sync_Module SHALL include a docs/CONTRIBUTING.md file that documents how to set up a development environment, how to run the test suite, code style expectations, how to add support for a new character class, and the pull request process.
8. WHEN a code change modifies the public API surface of the Demiplane_Client library (adding, removing, or changing exported symbols), THE developer SHALL update the corresponding README and JSDoc to reflect the change in the same commit.
9. WHEN a code change modifies the sync flow or hook registrations in the Sync_Module, THE developer SHALL update docs/ARCHITECTURE.md to reflect the change in the same commit.
10. WHEN a code change modifies the slug mapping rules in the Sync_Module, THE developer SHALL update the slug mapping section in docs/ARCHITECTURE.md to reflect the change in the same commit.
11. WHEN a code change introduces a new design decision or alters an existing one in the Sync_Module, THE developer SHALL update docs/DESIGN.md to document the decision and rationale in the same commit.

### Requirement 18: Dry Run Mode

**User Story:** As a Foundry GM, I want to preview what an import or export would change before committing the changes, so that I can verify the sync will produce the expected result without risking unintended modifications to either the Foundry actor or the Demiplane character.

#### Acceptance Criteria

1. WHILE the "Dry Run" module setting is enabled and a user triggers an import via the "Preview Import" button, THE Sync_Module SHALL fetch the character data from Demiplane, run the full slug mapping and import reconciliation logic, and produce a complete ImportSummary (items that would be added, removed, and skipped) without calling createEmbeddedDocuments, modifying actor items, or updating any actor state.
2. WHILE the "Dry Run" module setting is enabled and a user triggers an import, THE Sync_Module SHALL display the resulting ImportSummary in the Sync tab, clearly labeling it as a preview that has not been applied.
3. WHILE the "Dry Run" module setting is enabled and a user triggers an export via the "Preview Push" button, THE Sync_Module SHALL collect all pending session state changes and display each change as a field name and proposed value in the Sync tab without calling updateCharacterV2 or modifying the Demiplane character.
4. WHILE the "Dry Run" module setting is enabled, THE Sync_Module SHALL not modify the Foundry actor's embedded documents, flags, HP, currency, hero points, focus points, or any other actor state as a result of import or export operations.
5. WHILE the "Dry Run" module setting is enabled, THE Sync_Module SHALL not send any mutation requests (updateCharacterV2) to the Demiplane API.
6. WHILE the "Dry Run" module setting is disabled, THE Sync_Module SHALL perform import and export operations normally as described in Requirements 9 and 10, with no preview behavior.
7. WHEN the "Dry Run" module setting is toggled from enabled to disabled (or vice versa), THE Sync_Module SHALL update the Sync tab's visual indicator and button labels immediately without requiring a page reload.
