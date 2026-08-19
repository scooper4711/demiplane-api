import type { CharacterEngine, CustomEngine, DemiplaneEngine } from "./types.js";

export function isCustomEngine(engine: CharacterEngine): engine is CustomEngine {
  return engine.type === "CustomDemiplaneEngine";
}

export function isDemiplaneEngine(
  engine: CharacterEngine
): engine is DemiplaneEngine {
  return engine.type === "DemiplaneEngine";
}

export function findCustomEngineByName(
  engines: CharacterEngine[],
  storeName: string
): CustomEngine | undefined {
  return engines.find(
    (e): e is CustomEngine => isCustomEngine(e) && e.name === storeName
  );
}

export function findEnginesBySlug(
  engines: CharacterEngine[],
  slug: string
): DemiplaneEngine[] {
  return engines.filter(
    (e): e is DemiplaneEngine =>
      isDemiplaneEngine(e) && e.args.slug === slug
  );
}

export function findSpellEngines(engines: CharacterEngine[]): DemiplaneEngine[] {
  return engines.filter(
    (e): e is DemiplaneEngine =>
      isDemiplaneEngine(e) && e.name.startsWith("tabula/spell/")
  );
}

export function findSpellbookSpells(
  engines: CharacterEngine[]
): DemiplaneEngine[] {
  return findSpellEngines(engines).filter(
    (e) => e.args.addSpellData?.baseSpellbookSpell === true
  );
}

export function findPreparedSpells(
  engines: CharacterEngine[]
): DemiplaneEngine[] {
  return findSpellEngines(engines).filter(
    (e) => e.args.isPrepare === true
  );
}

export function isCurriculumSpell(engine: DemiplaneEngine): boolean {
  const slot = engine.args.spellSlot;
  return typeof slot === "string" && slot.includes("wizard-school-spellbook-slot");
}

export function updateCustomEngineValue(
  engines: CharacterEngine[],
  storeName: string,
  value: string | number | boolean
): CharacterEngine[] {
  return engines.map((e) => {
    if (isCustomEngine(e) && e.name === storeName) {
      return { ...e, value };
    }
    return e;
  });
}
