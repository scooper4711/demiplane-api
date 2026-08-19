import type { CharacterEngine, CustomEngine, DemiplaneEngine } from "./types.js";

/**
 * Type guard that checks whether an engine is a user-defined custom engine.
 * @param engine - The engine entry to check.
 * @returns `true` if the engine is a {@link CustomEngine}.
 */
export function isCustomEngine(engine: CharacterEngine): engine is CustomEngine {
  return engine.type === "CustomDemiplaneEngine";
}

/**
 * Type guard that checks whether an engine is a built-in Demiplane engine.
 * @param engine - The engine entry to check.
 * @returns `true` if the engine is a {@link DemiplaneEngine}.
 */
export function isDemiplaneEngine(
  engine: CharacterEngine
): engine is DemiplaneEngine {
  return engine.type === "DemiplaneEngine";
}

/**
 * Finds a custom engine by its store name.
 * @param engines - The array of character engines to search.
 * @param storeName - The store name to match against.
 * @returns The matching {@link CustomEngine}, or `undefined` if not found.
 */
export function findCustomEngineByName(
  engines: CharacterEngine[],
  storeName: string
): CustomEngine | undefined {
  return engines.find(
    (e): e is CustomEngine => isCustomEngine(e) && e.name === storeName
  );
}

/**
 * Finds all built-in Demiplane engines whose args contain a matching slug.
 * @param engines - The array of character engines to search.
 * @param slug - The slug value to match.
 * @returns An array of {@link DemiplaneEngine} entries with the given slug.
 */
export function findEnginesBySlug(
  engines: CharacterEngine[],
  slug: string
): DemiplaneEngine[] {
  return engines.filter(
    (e): e is DemiplaneEngine =>
      isDemiplaneEngine(e) && e.args.slug === slug
  );
}

/**
 * Finds all spell-related engines by matching names that start with "tabula/spell/".
 * @param engines - The array of character engines to search.
 * @returns An array of {@link DemiplaneEngine} entries representing spells.
 */
export function findSpellEngines(engines: CharacterEngine[]): DemiplaneEngine[] {
  return engines.filter(
    (e): e is DemiplaneEngine =>
      isDemiplaneEngine(e) && e.name.startsWith("tabula/spell/")
  );
}

/**
 * Finds all spellbook spell engines (spells marked as base spellbook entries).
 * @param engines - The array of character engines to search.
 * @returns An array of {@link DemiplaneEngine} entries that are base spellbook spells.
 */
export function findSpellbookSpells(
  engines: CharacterEngine[]
): DemiplaneEngine[] {
  return findSpellEngines(engines).filter(
    (e) => e.args.addSpellData?.baseSpellbookSpell === true
  );
}

/**
 * Finds all prepared spell engines.
 * @param engines - The array of character engines to search.
 * @returns An array of {@link DemiplaneEngine} entries marked as prepared spells.
 */
export function findPreparedSpells(
  engines: CharacterEngine[]
): DemiplaneEngine[] {
  return findSpellEngines(engines).filter(
    (e) => e.args.isPrepare === true
  );
}

/**
 * Checks whether a spell engine represents a curriculum (wizard school) spell
 * by inspecting its spell slot identifier.
 * @param engine - The Demiplane spell engine to check.
 * @returns `true` if the engine's spell slot contains "wizard-school-spellbook-slot".
 */
export function isCurriculumSpell(engine: DemiplaneEngine): boolean {
  const slot = engine.args.spellSlot;
  return typeof slot === "string" && slot.includes("wizard-school-spellbook-slot");
}

/**
 * Finds all engines whose name matches a regular expression pattern.
 * @param engines - The array of character engines to search.
 * @param pattern - The regular expression to test against engine names.
 * @returns An array of engines whose names match the pattern.
 */
export function findEnginesByNamePattern(
  engines: CharacterEngine[],
  pattern: RegExp
): CharacterEngine[] {
  return engines.filter((e) => pattern.test(e.name));
}

/**
 * Returns a new engines array with the specified custom engine's value updated.
 * If no engine matches the given store name, the original array is returned unchanged.
 *
 * @param engines - The array of character engines to update.
 * @param storeName - The store name of the custom engine to update.
 * @param value - The new value to assign.
 * @returns A new array with the matching custom engine's value replaced.
 *
 * @example
 * ```ts
 * const updated = updateCustomEngineValue(engines, "hp-override", 42);
 * ```
 */
export function updateCustomEngineValue(
  engines: CharacterEngine[],
  storeName: string,
  value: string | number | boolean
): CharacterEngine[] {
  const hasMatch = engines.some(
    (e) => isCustomEngine(e) && e.name === storeName
  );
  if (!hasMatch) {
    return engines;
  }
  return engines.map((e) => {
    if (isCustomEngine(e) && e.name === storeName) {
      return { ...e, value };
    }
    return e;
  });
}
