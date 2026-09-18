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
    const segments = [
      ...this.#databaseSegments(),
      "tables",
      tableId,
      "records",
    ];
    const firstPage = await this.#get<unknown>(segments);
    if (!Array.isArray(firstPage)) throw new Error("Unexpected Ninox records response");

    const pageSize = 100;
    const records = (firstPage as UnknownObject[]).slice(0, limit);
    if (records.length >= limit || firstPage.length < pageSize) {
      return records as NinoxRecord[];
    }

    const seen = new Set(records.map((record) => {
      const id = record.id;
      return id === undefined ? JSON.stringify(record) : `${typeof id}:${String(id)}`;
    }));
    let page = 1;

    while (records.length < limit) {
      const data = await this.#get<unknown>(segments, {
        params: { page, perPage: pageSize },
      });
      if (!Array.isArray(data)) throw new Error("Unexpected Ninox records response");

      let added = 0;
      for (const record of data as UnknownObject[]) {
        const id = record.id;
        const key = id === undefined ? JSON.stringify(record) : `${typeof id}:${String(id)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        records.push(record);
        added += 1;
        if (records.length >= limit) break;
      }

      if (data.length < pageSize || added === 0) break;
      page += 1;
    }

    return records as NinoxRecord[];
  }
}
