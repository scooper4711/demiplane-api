import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  isCustomEngine,
  isDemiplaneEngine,
  findCustomEngineByName,
  findEnginesBySlug,
  findEnginesByNamePattern,
  updateCustomEngineValue,
} from "../../src/engines.js";
import type {
  CharacterEngine,
  CustomEngine,
  DemiplaneEngine,
} from "../../src/types.js";

// --- Arbitraries for generating test data ---

const customEngineArb: fc.Arbitrary<CustomEngine> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1 }),
  value: fc.oneof(fc.integer(), fc.string(), fc.boolean()),
  type: fc.constant("CustomDemiplaneEngine" as const),
  saveType: fc.constantFrom(
    "CharacterBuilder" as const,
    "CharacterSheet" as const
  ),
  storeType: fc.constant("override" as const),
  demiplaneEngineId: fc.uuid(),
  args: fc.record({ id: fc.option(fc.uuid(), { nil: null }) }),
});

const demiplaneEngineArb: fc.Arbitrary<DemiplaneEngine> = fc.record({
  id: fc.uuid(),
  demiplaneEngineId: fc.uuid(),
  name: fc.string({ minLength: 1 }),
  type: fc.constant("DemiplaneEngine" as const),
  saveType: fc.constantFrom(
    "CharacterBuilder" as const,
    "CharacterSheet" as const
  ),
  args: fc.record({
    id: fc.option(fc.uuid(), { nil: null }),
    slug: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
  }),
});

const engineArb: fc.Arbitrary<CharacterEngine> = fc.oneof(
  customEngineArb,
  demiplaneEngineArb
);

const enginesArrayArb = fc.array(engineArb, { minLength: 0, maxLength: 20 });

// --- Property 1: Custom engine value update round-trip ---
// Validates: Requirements 7.5

describe("Feature: demiplane-foundry-sync, Property 1: Custom engine value update round-trip", () => {
  it("updating a value and then querying returns the new value", () => {
    fc.assert(
      fc.property(
        enginesArrayArb.filter((engines) =>
          engines.some((e) => e.type === "CustomDemiplaneEngine")
        ),
        fc.oneof(fc.integer(), fc.string(), fc.boolean()),
        (engines, newValue) => {
          const customEngine = engines.find(
            (e) => e.type === "CustomDemiplaneEngine"
          ) as CustomEngine;
          const updated = updateCustomEngineValue(
            engines,
            customEngine.name,
            newValue
          );
          const found = findCustomEngineByName(updated, customEngine.name);
          return found !== undefined && found.value === newValue;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 2: Immutable engine update preserves non-matching entries ---
// Validates: Requirements 7.2, 7.3

describe("Feature: demiplane-foundry-sync, Property 2: Immutable engine update preserves non-matching entries", () => {
  it("non-matching entries have referential equality after update", () => {
    fc.assert(
      fc.property(
        enginesArrayArb.filter((engines) =>
          engines.some((e) => e.type === "CustomDemiplaneEngine")
        ),
        fc.oneof(fc.integer(), fc.string(), fc.boolean()),
        (engines, newValue) => {
          const customEngine = engines.find(
            (e) => e.type === "CustomDemiplaneEngine"
          ) as CustomEngine;
          const updated = updateCustomEngineValue(
            engines,
            customEngine.name,
            newValue
          );
          return engines.every((original, i) => {
            if (
              original.type === "CustomDemiplaneEngine" &&
              original.name === customEngine.name
            ) {
              return true; // skip matched entries
            }
            return updated[i] === original; // referential equality
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 5: Engine type guard mutual exclusivity ---
// Validates: Requirements 6.1, 6.2

describe("Feature: demiplane-foundry-sync, Property 5: Engine type guard mutual exclusivity", () => {
  it("exactly one of isCustomEngine/isDemiplaneEngine is true for any engine", () => {
    fc.assert(
      fc.property(engineArb, (engine) => {
        const isCustom = isCustomEngine(engine);
        const isDemiplane = isDemiplaneEngine(engine);
        return (isCustom && !isDemiplane) || (!isCustom && isDemiplane);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 6: findEnginesBySlug returns only exact slug matches ---
// Validates: Requirements 6.4

describe("Feature: demiplane-foundry-sync, Property 6: findEnginesBySlug returns only exact slug matches", () => {
  it("all returned entries have the exact target slug and none are missing", () => {
    fc.assert(
      fc.property(
        enginesArrayArb,
        fc.string({ minLength: 1 }),
        (engines, targetSlug) => {
          const results = findEnginesBySlug(engines, targetSlug);
          const allMatch = results.every((e) => e.args.slug === targetSlug);
          const expectedCount = engines.filter(
            (e) =>
              e.type === "DemiplaneEngine" &&
              (e as DemiplaneEngine).args.slug === targetSlug
          ).length;
          return allMatch && results.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 7: findEnginesByNamePattern returns only matching entries ---
// Validates: Requirements 6.5

describe("Feature: demiplane-foundry-sync, Property 7: findEnginesByNamePattern returns only matching entries", () => {
  it("all returned entries match the pattern and no matching entries are missing", () => {
    fc.assert(
      fc.property(
        enginesArrayArb,
        fc.string({ minLength: 1, maxLength: 5 }),
        (engines, literal) => {
          const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const pattern = new RegExp(escaped);
          const results = findEnginesByNamePattern(engines, pattern);
          const allMatch = results.every((e) => pattern.test(e.name));
          const expectedCount = engines.filter((e) =>
            pattern.test(e.name)
          ).length;
          return allMatch && results.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 8: Update with non-existent store name returns original array ---
// Validates: Requirements 7.4

describe("Feature: demiplane-foundry-sync, Property 8: Update with non-existent store name returns original array", () => {
  it("returns the same array reference when no Custom_Engine matches", () => {
    fc.assert(
      fc.property(enginesArrayArb, fc.uuid(), (engines, uniqueSuffix) => {
        const nonExistentName =
          "$$_definitely_not_a_real_store_name_$$_" + uniqueSuffix;
        const result = updateCustomEngineValue(engines, nonExistentName, 42);
        return result === engines;
      }),
      { numRuns: 100 }
    );
  });
});
