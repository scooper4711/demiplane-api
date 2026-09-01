/**
 * Arguments attached to a character engine entry.
 * Contains identification and placement metadata used by the Demiplane character builder.
 */
export interface EngineArgs {
  /** Unique identifier for the engine argument set, or null if unset. */
  id: string | null;
  /** The builder UI section this engine belongs to. */
  builderSection?: string;
  /** Display name of the source row or feature. */
  name?: string;
  /** Reference to the parent engine that owns this entry. */
  parentEngine?: string;
  /** URL-safe slug identifying the game content source. */
  slug?: string;
  /** Identifier for the originating data row. */
  sourceRow?: string;
  /** Identifier for the data table this engine belongs to. */
  tableID?: string;
  /** Group key used for mutually exclusive selections. */
  selectionGroup?: string;
  /** Numeric rank within a selection group. */
  selectionRank?: number;
  /** Allows additional arbitrary properties. */
  [key: string]: unknown;
}

/**
 * A built-in Demiplane engine entry representing a character builder selection
 * such as a class feature, ancestry choice, or spell.
 */
export interface DemiplaneEngine {
  /** Unique identifier for this engine instance. */
  id: string;
  /** The Demiplane-assigned engine definition ID. */
  demiplaneEngineId: string;
  /** Qualified name of the engine (e.g. "tabula/spell/fireball"). */
  name: string;
  /** Discriminator indicating a built-in engine. */
  type: "DemiplaneEngine";
  /** Whether this engine was saved via the builder or the character sheet. */
  saveType: "CharacterBuilder" | "CharacterSheet";
  /** Arguments providing context and metadata for this engine entry. */
  args: EngineArgs;
}

/**
 * A user-defined custom engine entry that stores an override value
 * for a character attribute (e.g. a manual HP override or custom note).
 */
export interface CustomEngine {
  /** Unique identifier for this engine instance. */
  id: string;
  /** The store name identifying which attribute this overrides. */
  name: string;
  /** The override value stored by this custom engine. */
  value: string | number | boolean;
  /** Discriminator indicating a custom engine. */
  type: "CustomDemiplaneEngine";
  /** Whether this engine was saved via the builder or the character sheet. */
  saveType: "CharacterBuilder" | "CharacterSheet";
  /** The storage strategy; currently always "override". */
  storeType: "override";
  /** The Demiplane-assigned engine definition ID. */
  demiplaneEngineId: string;
  /** Arguments providing context and metadata for this engine entry. */
  args: EngineArgs;
}

/**
 * Union type representing any engine entry attached to a character,
 * either a built-in {@link DemiplaneEngine} or a user-defined {@link CustomEngine}.
 */
export type CharacterEngine = DemiplaneEngine | CustomEngine;

/**
 * The top-level data payload stored for a Demiplane character.
 * Contains all engine entries and a cache index mapping sources to engine IDs.
 */
export interface CharacterData {
  /** All engine entries (selections, overrides) for the character. */
  engines: CharacterEngine[];
  /** Index mapping source identifiers to arrays of engine cache IDs. */
  engineCacheIdsBySource: Record<string, string[]>;
  /** Character display name. */
  name?: string | undefined;
  /** Character level. */
  level?: number | undefined;
  /** URL for the character's avatar image. */
  avatarUrl?: string | undefined;
  /** View permission level. */
  viewPermission?: number | undefined;
  /** Edit permission level. */
  editPermission?: number | undefined;
  /** ISO timestamp of last save, used for optimistic concurrency. */
  updated?: string | undefined;
}

/**
 * Lightweight representation of a character's identity and optimistic-lock version.
 */
export interface CharacterVersion {
  /** The character's UUID. */
  uuid: string;
  /** The current version number, incremented on each save. */
  version: number;
}

/**
 * A single entry within a nexus attribute mapping, describing how a
 * character attribute is stored and displayed.
 */
export interface AttributeMappingEntry {
  /** Whether this attribute has been explicitly set on the character. */
  set: boolean;
  /** The store name used to look up this attribute's value. */
  store_name: string;
  /** Human-readable description of the attribute. */
  description: string;
  /** The data type of the attribute value (e.g. "number", "string"). */
  data_type?: string;
  /** Whether this attribute is shown as a token bar in the VTT. */
  token_bar_enabled: boolean;
  /** The store ID for this attribute entry. */
  store_id?: string;
  /** Store name for the attribute's maximum value, if applicable. */
  max_store_name?: string;
  /** Count of nested sub-attributes, if applicable. */
  count?: number;
  /** Name of a nested attribute within this entry. */
  nested_attribute_name?: string;
  /** Store name for the nested sub-attribute. */
  nested_store_attribute_name?: string;
}

/**
 * The attribute mapping configuration for a game system (nexus),
 * defining how character data maps to VTT token attributes.
 */
export interface AttributeMapping {
  /** The numeric nexus (game system) identifier. */
  nexusId: number;
  /** The unique ID of this mapping record. */
  id: string;
  /** Map of attribute keys to their mapping configuration entries. */
  attributeMapping: Record<string, AttributeMappingEntry>;
}

/**
 * A journal entry attached to a character (freeform notes with title + body).
 */
export interface CharacterJournal {
  /** Unique identifier for this journal entry. */
  objectID: string;
  /** The character UUID this journal belongs to. */
  characterId: string;
  /** Title of the journal entry (e.g. "Campaign", "Allies"). */
  title: string;
  /** Rich-text body content. */
  content: string;
  /** Plain-text description (often mirrors content). */
  description: string;
  /** ISO timestamp of creation. */
  createdDate: string;
  /** ISO timestamp of last modification. */
  lastModified: string;
}

/**
 * Options for updating a character via the Demiplane GraphQL API.
 */
export interface UpdateCharacterOptions {
  /** The character UUID to update. */
  id: string;
  /** The full character data payload to persist. */
  data: CharacterData;
  /** Optional new display name for the character. */
  name?: string | undefined;
  /** Optional new level for the character. */
  level?: number | undefined;
  /** Optional class slug for the character's primary class. */
  classSlug?: string | undefined;
  /** Optional URL for the character's avatar image. */
  avatarUrl?: string | undefined;
  /** Optional view permission level. */
  viewPermission?: number | undefined;
  /** Optional edit permission level. */
  editPermission?: number | undefined;
  /** Optional serialized character data for the Demiplane browser preview. */
  formatedData?: unknown;
  /** Optional flag enabling the admin-only view of the character. */
  adminView?: boolean | undefined;
  /** Optional UUID identifying the browser session that issued the update. */
  characterBrowserInstanceUuid?: string | undefined;
}
