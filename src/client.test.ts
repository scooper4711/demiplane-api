import { describe, it, expect } from "vitest";
import { DemiplaneClient } from "./client.js";

describe("DemiplaneClient", () => {
  it("throws when not authenticated", async () => {
    const client = new DemiplaneClient();
    await expect(
      client.fetchCharacterVersion("fake-uuid")
    ).rejects.toThrow("Not authenticated");
  });
});
