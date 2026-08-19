import type {
  DemiplaneAuthTokens,
  CharacterVersion,
  CharacterData,
  AttributeMapping,
  UpdateCharacterOptions,
} from "./types.js";

const GRAPHQL_ENDPOINT = "https://apiv4.demiplane.com/v1/graphql";
const APP_BASE = "https://app.demiplane.com";

export class DemiplaneClient {
  private tokens: DemiplaneAuthTokens | null = null;

  async authenticate(sessionCookie: string): Promise<DemiplaneAuthTokens> {
    const sessionResponse = await fetch(`${APP_BASE}/api/auth/token`, {
      headers: { cookie: sessionCookie },
    });

    if (!sessionResponse.ok) {
      throw new Error(
        `Auth token request failed: ${String(sessionResponse.status)}`
      );
    }

    const sessionToken = await sessionResponse.text();

    const graphqlResponse = await fetch(
      `${APP_BASE}/api/generate-graphql-token`,
      {
        method: "POST",
        headers: { cookie: sessionCookie },
      }
    );

    if (!graphqlResponse.ok) {
      throw new Error(
        `GraphQL token request failed: ${String(graphqlResponse.status)}`
      );
    }

    const graphqlToken = await graphqlResponse.text();

    this.tokens = { sessionToken, graphqlToken };
    return this.tokens;
  }

  async fetchCharacterVersion(characterId: string): Promise<CharacterVersion> {
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
      throw new Error(`No attribute mapping found for nexus: ${String(nexusId)}`);
    }

    return {
      nexusId: mapping.nexus_id,
      id: mapping.id,
      attributeMapping: mapping.attribute_mapping as AttributeMapping["attributeMapping"],
    };
  }

  async updateCharacter(options: UpdateCharacterOptions): Promise<boolean> {
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
  }

  private async executeGraphql<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    if (!this.tokens) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.tokens.graphqlToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${String(response.status)}`);
    }

    const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };

    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`
      );
    }

    if (!json.data) {
      throw new Error("GraphQL response missing data");
    }

    return json.data;
  }
}
