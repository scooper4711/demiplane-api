import { describe, it, expect } from "vitest";
import {
  isCustomEngine,
  isDemiplaneEngine,
  findCustomEngineByName,
  updateCustomEngineValue,
} from "./engines.js";
import type {
  CharacterEngine,
  CustomEngine,
  DemiplaneEngine,
} from "./types.js";

const mockCustomEngine: CustomEngine = {
  id: "custom_character_hit-points_current",
  name: "character_hit-points_current",
  value: 53,
  type: "CustomDemiplaneEngine",
  saveType: "CharacterSheet",
  storeType: "override",
  demiplaneEngineId: "uuid-123",
  args: { id: null },
};

const mockDemiplaneEngine: DemiplaneEngine = {
  id: "spell-id",
  demiplaneEngineId: "engine-uuid",
  name: "tabula/spell/fireball-rm.eng",
  type: "DemiplaneEngine",
  saveType: "CharacterSheet",
  args: {
    id: "selection-uuid",
    slug: "fireball-rm",
    selectionRank: 3,
  },
};

describe("isCustomEngine", () => {
  it("returns true for CustomDemiplaneEngine", () => {
    expect(isCustomEngine(mockCustomEngine)).toBe(true);
  });

  it("returns false for DemiplaneEngine", () => {
    expect(isCustomEngine(mockDemiplaneEngine)).toBe(false);
  });
});

describe("isDemiplaneEngine", () => {
  it("returns true for DemiplaneEngine", () => {
    expect(isDemiplaneEngine(mockDemiplaneEngine)).toBe(true);
  });

  it("returns false for CustomDemiplaneEngine", () => {
    expect(isDemiplaneEngine(mockCustomEngine)).toBe(false);
  });
});

describe("findCustomEngineByName", () => {
  it("finds engine by store name", () => {
    const engines: CharacterEngine[] = [mockCustomEngine, mockDemiplaneEngine];
    const result = findCustomEngineByName(
      engines,
      "character_hit-points_current"
    );
    expect(result).toEqual(mockCustomEngine);
  });

  it("returns undefined when not found", () => {
    const engines: CharacterEngine[] = [mockDemiplaneEngine];
    const result = findCustomEngineByName(engines, "nonexistent");
    expect(result).toBeUndefined();
  });
});

describe("updateCustomEngineValue", () => {
  it("updates the value of a matching custom engine", () => {
    const engines: CharacterEngine[] = [mockCustomEngine, mockDemiplaneEngine];
    const updated = updateCustomEngineValue(
      engines,
      "character_hit-points_current",
      42
    );
    const hp = updated[0] as CustomEngine;
    expect(hp.value).toBe(42);
  });

  it("does not modify non-matching engines", () => {
    const engines: CharacterEngine[] = [mockCustomEngine, mockDemiplaneEngine];
    const updated = updateCustomEngineValue(engines, "nonexistent", 99);
    expect(updated).toEqual(engines);
  });
});
