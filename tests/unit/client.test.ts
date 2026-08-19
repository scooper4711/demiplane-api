import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DemiplaneClient } from "../../src/client.js";
import { DemiplaneApiError } from "../../src/errors.js";

describe("DemiplaneClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

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
      await expect(
        client.authenticate("user@example.com", "")
      ).rejects.toThrow(
        "Both email and password are required for authentication"
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("throws DemiplaneApiError when login request returns non-200", async () => {
      const client = new DemiplaneClient();
      fetchSpy.mockResolvedValueOnce(
        new Response(null, { status: 401 })
      );

      await expect(
        client.authenticate("user@example.com", "password123")
      ).rejects.toSatisfy((error: unknown) => {
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

      await expect(
        client.authenticate("user@example.com", "password123")
      ).rejects.toThrow(/Failed to parse authentication response as JSON/);
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
      fetchSpy.mockResolvedValueOnce(
        new Response(null, { status: 403 })
      );

      await expect(
        client.authenticate("user@example.com", "password123")
      ).rejects.toSatisfy((error: unknown) => {
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

      await expect(
        client.authenticate("user@example.com", "password123")
      ).rejects.toThrow(
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
      const requestInit = graphqlCall[1] as RequestInit;
      const headers = requestInit.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer graphql-token-xyz");
    });
  });

  describe("unauthenticated read access", () => {
    it("fetchCharacterVersion works without authentication", async () => {
      const client = new DemiplaneClient();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              demiplane_user_character: [
                { uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", version: 5 },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const result = await client.fetchCharacterVersion("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
      expect(result).toEqual({ uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", version: 5 });

      // Verify no Authorization header was sent
      const requestInit = fetchSpy.mock.calls[0][1] as RequestInit;
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
      ).rejects.toThrow(
        "Authentication is required for write operations"
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("DemiplaneApiError", () => {
    it("has correct statusCode, operationName, and requestUrl properties", () => {
      const error = new DemiplaneApiError(
        404,
        "character fetch",
        "https://apiv4.demiplane.com/v1/graphql"
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DemiplaneApiError);
      expect(error.statusCode).toBe(404);
      expect(error.operationName).toBe("character fetch");
      expect(error.requestUrl).toBe(
        "https://apiv4.demiplane.com/v1/graphql"
      );
      expect(error.name).toBe("DemiplaneApiError");
      expect(error.message).toBe("character fetch failed with status 404");
    });
  });
});
