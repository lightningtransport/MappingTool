import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import type { NinoxConfig } from "../config/env.js";
import type {
  NinoxDatabaseSchema,
  NinoxRecord,
  NinoxTableSchema,
  UnknownObject,
} from "./types.js";

export interface ReadOnlyNinoxClient {
  getDatabaseSchema(): Promise<NinoxDatabaseSchema>;
  getTables(): Promise<NinoxTableSchema[]>;
  getTable(tableId: string): Promise<NinoxTableSchema>;
  getSampleRecords(tableId: string, limit?: number): Promise<NinoxRecord[]>;
}

function segment(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("Ninox path segments cannot be empty");
  return encodeURIComponent(normalized);
}

export class AxiosReadOnlyNinoxClient implements ReadOnlyNinoxClient {
  readonly #http: AxiosInstance;
  readonly #config: NinoxConfig;

  constructor(config: NinoxConfig, http?: AxiosInstance) {
    this.#config = config;
    this.#http = http ?? axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
    });
  }

  async #get<T>(segments: string[], request?: AxiosRequestConfig): Promise<T> {
    const path = `/${segments.map(segment).join("/")}`;
    const response = await this.#http.get<T>(path, request);
    return response.data;
  }

  #databaseSegments(): string[] {
    return ["teams", this.#config.teamId, "databases", this.#config.databaseId];
  }

  getDatabaseSchema(): Promise<NinoxDatabaseSchema> {
    return this.#get<NinoxDatabaseSchema>(this.#databaseSegments());
  }

  async getTables(): Promise<NinoxTableSchema[]> {
    const data = await this.#get<unknown>([...this.#databaseSegments(), "tables"]);
    if (!Array.isArray(data)) throw new Error("Unexpected Ninox tables response");
    return data as NinoxTableSchema[];
  }

  getTable(tableId: string): Promise<NinoxTableSchema> {
    return this.#get<NinoxTableSchema>([...this.#databaseSegments(), "tables", tableId]);
  }

  async getSampleRecords(tableId: string, limit = this.#config.sampleLimit): Promise<NinoxRecord[]> {
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("Sample limit must be positive");
    const data = await this.#get<unknown>([
      ...this.#databaseSegments(),
      "tables",
      tableId,
      "records",
    ]);
    if (!Array.isArray(data)) throw new Error("Unexpected Ninox records response");

    // The documented endpoint has no pagination parameter. Limit locally until a
    // verified Ninox-supported sampling mechanism is discovered.
    return (data as UnknownObject[]).slice(0, limit) as NinoxRecord[];
  }
}
