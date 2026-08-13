import type { NinoxConfig } from "../config/env.js";
import { AxiosReadOnlyNinoxClient } from "./client.js";
import { sanitizeError } from "./sanitize.js";
import type { ConnectionResult } from "./types.js";

export async function testConnection(config: NinoxConfig): Promise<ConnectionResult> {
  try {
    const database = await new AxiosReadOnlyNinoxClient(config).getDatabaseSchema();
    return {
      connected: true,
      status: 200,
      databaseId: config.databaseId,
      databaseName: typeof database.name === "string" ? database.name : undefined,
    };
  } catch (error) {
    const safe = sanitizeError(error);
    return {
      connected: false,
      status: safe.status,
      databaseId: config.databaseId,
      error: safe.message,
    };
  }
}
