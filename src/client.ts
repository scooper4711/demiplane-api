import { DemiplaneApiError } from "./errors.js";
import type {
  CharacterVersion,
  CharacterData,
  AttributeMapping,
  UpdateCharacterOptions,
} from "./types.js";

const GRAPHQL_ENDPOINT = "https://apiv4.demiplane.com/v1/graphql";
const APP_BASE = "https://app.demiplane.com";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(characterId: string): void {
  if (!UUID_PATTERN.test(characterId)) {
    throw new Error(`Invalid UUID format: ${characterId}`);
  }
}

function validateNexusId(nexusId: number): void {
  if (!Number.isInteger(nexusId) || nexusId <= 0) {
    throw new Error(
      `Invalid nexus ID: must be a positive integer, got ${String(nexusId)}`
    );
  }
}

export class DemiplaneClient {
  private graphqlToken: string | null = null;

  async authenticate(email: string, password: string): Promise<void> {
    if (!email || !password) {
      throw new Error(
        "Both email and password are required for authentication"
      );
    }

    const loginUrl = `${APP_BASE}/api/auth/login`;
    let loginResponse: Response;
    try {
      loginResponse = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new DemiplaneApiError(0, "authentication request", loginUrl);
    }

    if (!loginResponse.ok) {
      throw new DemiplaneApiError(
        loginResponse.status,
        "authentication request",
        loginUrl
      );
    }

    let loginData: { sessionToken?: string };
    try {
      loginData = (await loginResponse.json()) as { sessionToken?: string };
    } catch {
      throw new Error(
        "Failed to parse authentication response as JSON for operation: authentication request"
      );
    }

    const sessionToken = loginData.sessionToken;
    if (!sessionToken) {
      throw new Error("Authentication response missing session token");
    }

    const graphqlTokenUrl = `${APP_BASE}/api/generate-graphql-token`;
    let graphqlResponse: Response;
    try {
      graphqlResponse = await fetch(graphqlTokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      });
    } catch {
      throw new DemiplaneApiError(0, "GraphQL token request", graphqlTokenUrl);
    }

    if (!graphqlResponse.ok) {
      throw new DemiplaneApiError(
        graphqlResponse.status,
        "GraphQL token request",
        graphqlTokenUrl
      );
    }

    let graphqlData: { token?: string };
    try {
      graphqlData = (await graphqlResponse.json()) as { token?: string };
    } catch {
      throw new Error(
        "Failed to parse GraphQL token response as JSON for operation: GraphQL token request"
      );
    }

    const graphqlToken = graphqlData.token;
    if (!graphqlToken) {
      throw new Error("GraphQL token response missing token");
    }

    this.graphqlToken = graphqlToken;
  }

  async fetchCharacterData(characterId: string): Promise<CharacterData> {
    validateUuid(characterId);

    const query = `query character_data($id: uuid!) {
      demiplane_user_character(
        where: {uuid: {_eq: $id}, deleted_at: {_is_null: true}, enabled: {_eq: true}}
      ) {
        data
      }
    }`;

    const result = await this.executeGraphql<{
      demiplane_user_character: Array<{ data: CharacterData | null }>;
    }>(query, { id: characterId });

    const character = result.demiplane_user_character[0];
    if (!character || !character.data) {
      throw new Error(`Character not found: ${characterId}`);
    }

    const characterData = character.data;
    if (!characterData.engines || !Array.isArray(characterData.engines)) {
      throw new Error(
        `Invalid response structure: character ${characterId} is missing engines array`
      );
    }

    return characterData;
  }

  async fetchCharacterVersion(characterId: string): Promise<CharacterVersion> {
    validateUuid(characterId);

    const query = `query character_version($id: uuid!) {
      demiplane_user_character(
        where: {uuid: {_eq: $id}, deleted_at: {_is_null: true}, enabled: {_eq: true}}
      ) {
        uuid
        version
      }
    }`;

    const result = await this.executeGraphql<{
      demiplane_user_character: CharacterVersion[];
    }>(query, { id: characterId });

    const character = result.demiplane_user_character[0];
    if (!character) {
      throw new Error(`Character not found: ${characterId}`);
    }

    return character;
  }

  async fetchAttributeMapping(nexusId: number): Promise<AttributeMapping> {
    validateNexusId(nexusId);

    const query = `query getCharacterAttributeMapping($nexusId: Int!) {
      demiplane_character_attribute_mapping(where: {nexus_id: {_eq: $nexusId}}) {
        nexus_id
        id
        attribute_mapping
      }
    }`;

    const result = await this.executeGraphql<{
      demiplane_character_attribute_mapping: Array<{
        nexus_id: number;
        id: string;
        attribute_mapping: Record<string, unknown>;
      }>;
    }>(query, { nexusId });

    const mapping = result.demiplane_character_attribute_mapping[0];
    if (!mapping) {
      throw new Error(
        `No attribute mapping found for nexus: ${String(nexusId)}`
      );
    }

    return {
      nexusId: mapping.nexus_id,
      id: mapping.id,
      attributeMapping:
        mapping.attribute_mapping as AttributeMapping["attributeMapping"],
    };
  }

  async updateCharacter(options: UpdateCharacterOptions): Promise<boolean> {
    if (!this.graphqlToken) {
      throw new Error(
        "Authentication is required for write operations. Call authenticate() first."
      );
    }

    if (!options.id || !options.data?.engines) {
      return false;
    }

    const query = `mutation updateCharacterV2(
      $id: String!,
      $data: json!,
      $name: String,
      $level: Int,
      $classSlug: String,
      $avatarUrl: String,
      $viewPermission: Int,
      $editPermission: Int
    ) {
      updateCharacterV2(
        id: $id,
        data: $data,
        name: $name,
        level: $level,
        classSlug: $classSlug,
        avatarUrl: $avatarUrl,
        viewPermission: $viewPermission,
        editPermission: $editPermission
      ) {
        message
        result
        success
      }
    }`;

    try {
      const result = await this.executeGraphql<{
        updateCharacterV2: { success: boolean; message: string };
      }>(query, {
        id: options.id,
        data: options.data,
        name: options.name,
        level: options.level,
        classSlug: options.classSlug,
        avatarUrl: options.avatarUrl,
        viewPermission: options.viewPermission,
        editPermission: options.editPermission,
      });

      return result.updateCharacterV2.success;
    } catch {
      return false;
    }
  }

  private async executeGraphql<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.graphqlToken) {
      headers["Authorization"] = `Bearer ${this.graphqlToken}`;
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new DemiplaneApiError(
        response.status,
        "GraphQL request",
        GRAPHQL_ENDPOINT
      );
    }

    let json: { data?: T; errors?: Array<{ message: string }> };
    try {
      json = (await response.json()) as {
        data?: T;
        errors?: Array<{ message: string }>;
      };
    } catch {
      throw new Error(
        "Failed to parse GraphQL response as JSON for operation: GraphQL request"
      );
    }

    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`
      );
    }

    if (!json.data) {
      throw new Error("GraphQL response missing data");
    }

    return json.data;
  }
}
