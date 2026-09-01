import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { DemiplaneClient } from "../../src/client.js";
import { DemiplaneApiError } from "../../src/errors.js";

describe("DemiplaneClient", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  function createAuthenticatedClient(): DemiplaneClient {
    const client = new DemiplaneClient();
    client.setToken("gql-tok");
    return client;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateToken", () => {
    it("succeeds when the authenticated read is accepted", async () => {
      const client = createAuthenticatedClient();
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { demiplane_user_character: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await expect(client.validateToken()).resolves.toBeUndefined();
      const requestInit = fetchSpy.mock.calls[0]![1] as RequestInit;
      expect((requestInit.headers as Record<string, string>).Authorization).toBe("Bearer gql-tok");
    });

    it("rejects when no token is configured", async () => {
      await expect(new DemiplaneClient().validateToken()).rejects.toThrow("A GraphQL token is required for validation");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("unauthenticated read access", () => {
    it("fetchCharacterVersion works without authentication", async () => {
      const client = new DemiplaneClient();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              demiplane_user_character: [{ uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", version: 5 }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const result = await client.fetchCharacterVersion("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
      expect(result).toEqual({
        uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        version: 5,
      });

      // Verify no Authorization header was sent
      const requestInit = fetchSpy.mock.calls[0]![1] as RequestInit;
      const headers = requestInit.headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });
  });

  describe("write rejection without authentication", () => {
    it("updateCharacter throws when called without authentication", async () => {
      const client = new DemiplaneClient();

      await expect(
        client.updateCharacter({
          id: "fake-id",
          data: { engines: [], engineCacheIdsBySource: {} },
        })
      ).rejects.toThrow("Authentication is required for write operations");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("DemiplaneApiError", () => {
    it("has correct statusCode, operationName, and requestUrl properties", () => {
      const error = new DemiplaneApiError(404, "character fetch", "https://apiv4.demiplane.com/v1/graphql");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DemiplaneApiError);
      expect(error.statusCode).toBe(404);
      expect(error.operationName).toBe("character fetch");
      expect(error.requestUrl).toBe("https://apiv4.demiplane.com/v1/graphql");
      expect(error.name).toBe("DemiplaneApiError");
      expect(error.message).toBe("character fetch failed with status 404");
    });
  });

  describe("fetchCharacterData", () => {
    it("returns character data on success", async () => {
      const client = new DemiplaneClient();
      const mockData = {
        engines: [
          {
            id: "1",
            name: "test",
            type: "CustomDemiplaneEngine",
            value: 10,
            saveType: "CharacterSheet",
            storeType: "override",
            demiplaneEngineId: "e1",
            args: { id: null },
          },
        ],
        engineCacheIdsBySource: { source1: ["id1"] },
      };
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { demiplane_user_character: [{ data: mockData }] },
          }),
          { status: 200 }
        )
      );
      const result = await client.fetchCharacterData("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
      expect(result.engines).toHaveLength(1);
      expect(result.engineCacheIdsBySource).toEqual({ source1: ["id1"] });
    });

    it("throws when character not found", async () => {
      const client = new DemiplaneClient();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { demiplane_user_character: [] },
          }),
          { status: 200 }
        )
      );
      await expect(client.fetchCharacterData("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).rejects.toThrow(
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
      );
    });

    it("throws when response has GraphQL errors", async () => {
      const client = new DemiplaneClient();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            errors: [{ message: "err1" }, { message: "err2" }],
          }),
          { status: 200 }
        )
      );
      await expect(client.fetchCharacterData("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).rejects.toThrow("err1; err2");
    });

    it("throws when engines array is missing", async () => {
      const client = new DemiplaneClient();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              demiplane_user_character: [{ data: { engineCacheIdsBySource: {} } }],
            },
          }),
          { status: 200 }
        )
      );
      await expect(client.fetchCharacterData("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).rejects.toThrow(
        "missing engines array"
      );
    });
  });

  describe("UUID validation", () => {
    it("fetchCharacterData throws for invalid UUID", async () => {
      const client = new DemiplaneClient();
      await expect(client.fetchCharacterData("not-a-uuid")).rejects.toThrow("Invalid UUID format");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fetchCharacterVersion throws for invalid UUID", async () => {
      const client = new DemiplaneClient();
      await expect(client.fetchCharacterVersion("bad")).rejects.toThrow("Invalid UUID format");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("Nexus ID validation", () => {
    it("fetchAttributeMapping throws for zero", async () => {
      const client = new DemiplaneClient();
      await expect(client.fetchAttributeMapping(0)).rejects.toThrow("Invalid nexus ID");
    });

    it("fetchAttributeMapping throws for negative", async () => {
      const client = new DemiplaneClient();
      await expect(client.fetchAttributeMapping(-1)).rejects.toThrow("Invalid nexus ID");
    });

    it("fetchAttributeMapping throws for non-integer", async () => {
      const client = new DemiplaneClient();
      await expect(client.fetchAttributeMapping(1.5)).rejects.toThrow("Invalid nexus ID");
    });
  });

  describe("updateCharacter error handling", () => {
    it("throws error when id is empty", async () => {
      const client = createAuthenticatedClient();
      await expect(
        client.updateCharacter({
          id: "",
          data: { engines: [], engineCacheIdsBySource: {} },
        })
      ).rejects.toThrow("Invalid UpdateCharacterOptions - please provide both id and engines");
    });

    it("throws error when engines is missing from data", async () => {
      const client = createAuthenticatedClient();
      await expect(
        client.updateCharacter({
          id: "some-id",
          data: {} as any,
        })
      ).rejects.toThrow("Invalid UpdateCharacterOptions - please provide both id and engines");
    });

    it("returns failure result on network error", async () => {
      const client = createAuthenticatedClient();
      fetchSpy.mockRejectedValueOnce(new Error("network failure"));
      const result = await client.updateCharacter({
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        data: { engines: [], engineCacheIdsBySource: {} },
      });
      expect(result.success).toBe(false);
      expect(result.result).toBeNull();
    });

    it("returns failure result on non-200 response", async () => {
      const client = createAuthenticatedClient();
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));
      const result = await client.updateCharacter({
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        data: { engines: [], engineCacheIdsBySource: {} },
      });
      expect(result.success).toBe(false);
      expect(result.result).toBeNull();
    });

    it("returns success result when mutation succeeds", async () => {
      const client = createAuthenticatedClient();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { updateCharacterV2: { success: true, message: "ok" } },
          }),
          { status: 200 }
        )
      );
      const result = await client.updateCharacter({
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        data: { engines: [], engineCacheIdsBySource: {} },
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe("ok");
    });

    it("returns failure result when mutation returns success: false", async () => {
      const client = createAuthenticatedClient();
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              updateCharacterV2: { success: false, message: "fail" },
            },
          }),
          { status: 200 }
        )
      );
      const result = await client.updateCharacter({
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        data: { engines: [], engineCacheIdsBySource: {} },
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("fail");
    });
  });

  describe("character journals", () => {
    const CHARACTER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const JOURNAL_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

    function makeJournal(overrides: Record<string, unknown> = {}) {
      return {
        objectID: JOURNAL_ID,
        characterId: CHARACTER_ID,
        title: "Campaign",
        content: "the notes",
        description: "the notes",
        createdDate: "2026-01-01T00:00:00.000Z",
        lastModified: "2026-01-02T00:00:00.000Z",
        ...overrides,
      };
    }

    /** Reads the GraphQL query string sent in the most recent fetch call. */
    function lastSentQuery(): string {
      const requestInit = fetchSpy.mock.calls.at(-1)![1] as RequestInit;
      return (JSON.parse(requestInit.body as string) as { query: string }).query;
    }

    describe("fetchCharacterJournals", () => {
      it("returns the journal items on success", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { slsGetCharacterJournals: { data: { items: [makeJournal()] }, success: true, message: null } },
            }),
            { status: 200 }
          )
        );

        const result = await client.fetchCharacterJournals(CHARACTER_ID);
        expect(result).toHaveLength(1);
        expect(result[0]!.title).toBe("Campaign");
        expect(result[0]!.description).toBe("the notes");
      });

      it("selects `data` as a scalar (no subselection) to avoid the schema validation error", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { slsGetCharacterJournals: { data: { items: [] }, success: true, message: null } },
            }),
            { status: 200 }
          )
        );

        await client.fetchCharacterJournals(CHARACTER_ID);
        const query = lastSentQuery();
        // Regression guard: `data { items { ... } }` triggers
        // "unexpected subselection set for non-object field".
        expect(query).not.toMatch(/data\s*\{/);
      });

      it("returns an empty array when the payload has no items", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { slsGetCharacterJournals: { data: null, success: true, message: null } },
            }),
            { status: 200 }
          )
        );

        await expect(client.fetchCharacterJournals(CHARACTER_ID)).resolves.toEqual([]);
      });

      it("throws with the server message when success is false", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { slsGetCharacterJournals: { data: null, success: false, message: "nope" } },
            }),
            { status: 200 }
          )
        );

        await expect(client.fetchCharacterJournals(CHARACTER_ID)).rejects.toThrow("nope");
      });

      it("throws for an invalid UUID without calling fetch", async () => {
        const client = createAuthenticatedClient();
        await expect(client.fetchCharacterJournals("bad")).rejects.toThrow("Invalid UUID format");
        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });

    describe("createCharacterJournal", () => {
      it("returns the created journal item on success", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { slsCreateCharacterJournal: { data: { item: makeJournal() }, success: true, message: null } },
            }),
            { status: 200 }
          )
        );

        const result = await client.createCharacterJournal(CHARACTER_ID, "Campaign", "the notes");
        expect(result.objectID).toBe(JOURNAL_ID);
        expect(result.description).toBe("the notes");
      });

      it("selects `data` as a scalar (no subselection)", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { slsCreateCharacterJournal: { data: { item: makeJournal() }, success: true, message: null } },
            }),
            { status: 200 }
          )
        );

        await client.createCharacterJournal(CHARACTER_ID, "Campaign", "the notes");
        expect(lastSentQuery()).not.toMatch(/data\s*\{/);
      });

      it("throws when success is false", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { slsCreateCharacterJournal: { data: null, success: false, message: "create failed" } },
            }),
            { status: 200 }
          )
        );

        await expect(client.createCharacterJournal(CHARACTER_ID, "Campaign", "x")).rejects.toThrow("create failed");
      });

      it("throws when the payload is missing the created item", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { slsCreateCharacterJournal: { data: null, success: true, message: null } },
            }),
            { status: 200 }
          )
        );

        await expect(client.createCharacterJournal(CHARACTER_ID, "Campaign", "x")).rejects.toThrow(
          "Failed to create journal"
        );
      });

      it("throws for an invalid character UUID without calling fetch", async () => {
        const client = createAuthenticatedClient();
        await expect(client.createCharacterJournal("bad", "Campaign", "x")).rejects.toThrow("Invalid UUID format");
        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });

    describe("updateCharacterJournal", () => {
      it("returns the updated journal item on success", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                slsUpdateCharacterJournal: {
                  data: { item: makeJournal({ description: "updated" }) },
                  success: true,
                  message: null,
                },
              },
            }),
            { status: 200 }
          )
        );

        const result = await client.updateCharacterJournal(JOURNAL_ID, CHARACTER_ID, "Campaign", "updated");
        expect(result.description).toBe("updated");
      });

      it("selects `data` as a scalar (no subselection)", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { slsUpdateCharacterJournal: { data: { item: makeJournal() }, success: true, message: null } },
            }),
            { status: 200 }
          )
        );

        await client.updateCharacterJournal(JOURNAL_ID, CHARACTER_ID, "Campaign", "x");
        expect(lastSentQuery()).not.toMatch(/data\s*\{/);
      });

      it("throws when success is false", async () => {
        const client = createAuthenticatedClient();
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: { slsUpdateCharacterJournal: { data: null, success: false, message: "update failed" } },
            }),
            { status: 200 }
          )
        );

        await expect(client.updateCharacterJournal(JOURNAL_ID, CHARACTER_ID, "Campaign", "x")).rejects.toThrow(
          "update failed"
        );
      });

      it("throws for an invalid journal UUID without calling fetch", async () => {
        const client = createAuthenticatedClient();
        await expect(client.updateCharacterJournal("bad", CHARACTER_ID, "Campaign", "x")).rejects.toThrow(
          "Invalid UUID format"
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("throws for an invalid character UUID without calling fetch", async () => {
        const client = createAuthenticatedClient();
        await expect(client.updateCharacterJournal(JOURNAL_ID, "bad", "Campaign", "x")).rejects.toThrow(
          "Invalid UUID format"
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });
  });
});
