export interface DemiplaneAuthTokens {
  sessionToken: string;
  graphqlToken: string;
}

export interface EngineArgs {
  id: string | null;
  builderSection?: string;
  name?: string;
  parentEngine?: string;
  slug?: string;
  sourceRow?: string;
  tableID?: string;
  selectionGroup?: string;
  spellSlot?: string;
  selectionRank?: number;
  parentSpellFeature?: string;
  isPrepare?: boolean;
  addSpellData?: { baseSpellbookSpell: boolean };
  [key: string]: unknown;
}

export interface DemiplaneEngine {
  id: string;
  demiplaneEngineId: string;
  name: string;
  type: "DemiplaneEngine";
  saveType: "CharacterBuilder" | "CharacterSheet";
  args: EngineArgs;
}

export interface CustomEngine {
  id: string;
  name: string;
  value: string | number | boolean;
  type: "CustomDemiplaneEngine";
  saveType: "CharacterBuilder" | "CharacterSheet";
  storeType: "override";
  demiplaneEngineId: string;
  args: EngineArgs;
}

export type CharacterEngine = DemiplaneEngine | CustomEngine;

export interface CharacterData {
  engines: CharacterEngine[];
  engineCacheIdsBySource: Record<string, string[]>;
}

export interface CharacterVersion {
  uuid: string;
  version: number;
}

export interface AttributeMappingEntry {
  set: boolean;
  store_name: string;
  description: string;
  data_type?: string;
  token_bar_enabled: boolean;
  store_id?: string;
  max_store_name?: string;
  count?: number;
  nested_attribute_name?: string;
  nested_store_attribute_name?: string;
}

export interface AttributeMapping {
  nexusId: number;
  id: string;
  attributeMapping: Record<string, AttributeMappingEntry>;
}

export interface UpdateCharacterOptions {
  id: string;
  data: CharacterData;
  name?: string;
  level?: number;
  classSlug?: string;
  avatarUrl?: string;
  viewPermission?: number;
  editPermission?: number;
}
