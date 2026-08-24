import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { DemiplaneClient } from "../../src/client.js";
import { DemiplaneApiError } from "../../src/errors.js";

describe("DemiplaneClient", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  async function createAuthenticatedClient(): Promise<DemiplaneClient> {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ sessionToken: "tok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "gql-tok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const client = new DemiplaneClient();
    await client.authenticate("user@test.com", "pass");
    return client;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authenticate", () => {
    it("throws when email is empty", async () => {
      const client = new DemiplaneClient();
      await expect(client.authenticate("", "password123")).rejects.toThrow(
        "Both email and password are required for authentication"
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("throws when password is empty", async () => {
      const client = new DemiplaneClient();
      await expect(client.authenticate("user@example.com", "")).rejects.toThrow(
        "Both email and password are required for authentication"
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("throws DemiplaneApiError when login request returns non-200", async () => {
      const client = new DemiplaneClient();
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }));

      await expect(client.authenticate("user@example.com", "password123")).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(DemiplaneApiError);
        const apiError = error as DemiplaneApiError;
        expect(apiError.statusCode).toBe(401);
        expect(apiError.operationName).toBe("authentication request");
        expect(apiError.requestUrl).toContain("/api/auth/login");
        return true;
      });
    });

    it("throws when login response JSON is unparseable", async () => {
      const client = new DemiplaneClient();
      fetchSpy.mockResolvedValueOnce(
        new Response("not-json{{{", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        })
      );

      await expect(client.authenticate("user@example.com", "password123")).rejects.toThrow(
        /Failed to parse authentication response as JSON/
      );
    });

    it("throws DemiplaneApiError when GraphQL token request fails", async () => {
      const client = new DemiplaneClient();

      // Login succeeds
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ sessionToken: "session-abc" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      // GraphQL token request fails
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 403 }));

      await expect(client.authenticate("user@example.com", "password123")).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(DemiplaneApiError);
        const apiError = error as DemiplaneApiError;
        expect(apiError.statusCode).toBe(403);
        expect(apiError.operationName).toBe("GraphQL token request");
        expect(apiError.requestUrl).toContain("/api/generate-graphql-token");
        return true;
      });
    });

    it("throws when GraphQL token response JSON is unparseable", async () => {
      const client = new DemiplaneClient();

      // Login succeeds
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ sessionToken: "session-abc" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      // GraphQL token response is not valid JSON
      fetchSpy.mockResolvedValueOnce(
        new Response("invalid-json", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        })
      );

      await expect(client.authenticate("user@example.com", "password123")).rejects.toThrow(
        /Failed to parse GraphQL token response as JSON/
      );
    });

    it("stores token on success and attaches Bearer header on subsequent requests", async () => {
      const client = new DemiplaneClient();

      // Login succeeds
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ sessionToken: "session-abc" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      // GraphQL token request succeeds
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "graphql-token-xyz" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await client.authenticate("user@example.com", "password123");

      // Now make a GraphQL request and verify the Bearer header is attached
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              demiplane_user_character: [{ uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", version: 1 }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      await client.fetchCharacterVersion("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

      const graphqlCall = fetchSpy.mock.calls[2];
      const requestInit = graphqlCall![1] as RequestInit;
      const headers = requestInit.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer graphql-token-xyz");
    });
  });

  describe("validateToken", () => {
    it("succeeds when the authenticated read is accepted", async () => {
      const client = await createAuthenticatedClient();
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { demiplane_user_character: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await expect(client.validateToken()).resolves.toBeUndefined();
      const requestInit = fetchSpy.mock.calls[2]![1] as RequestInit;
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
      const client = await createAuthenticatedClient();
      await expect(
        client.updateCharacter({
          id: "",
          data: { engines: [], engineCacheIdsBySource: {} },
        })
      ).rejects.toThrow("Invalid UpdateCharacterOptions - please provide both id and engines");
    });

    it("throws error when engines is missing from data", async () => {
      const client = await createAuthenticatedClient();
      await expect(
        client.updateCharacter({
          id: "some-id",
          data: {} as any,
        })
      ).rejects.toThrow("Invalid UpdateCharacterOptions - please provide both id and engines");
    });

    it("returns false on network error", async () => {
      const client = await createAuthenticatedClient();
      fetchSpy.mockRejectedValueOnce(new Error("network failure"));
      const result = await client.updateCharacter({
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        data: { engines: [], engineCacheIdsBySource: {} },
      });
      expect(result).toBe(false);
    });

    it("returns false on non-200 response", async () => {
      const client = await createAuthenticatedClient();
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));
      const result = await client.updateCharacter({
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        data: { engines: [], engineCacheIdsBySource: {} },
      });
      expect(result).toBe(false);
    });

    it("returns true when mutation succeeds", async () => {
      const client = await createAuthenticatedClient();
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
      expect(result).toBe(true);
    });

    it("returns false when mutation returns success: false", async () => {
      const client = await createAuthenticatedClient();
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
      expect(result).toBe(false);
    });
  });
});
