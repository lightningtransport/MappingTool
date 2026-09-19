import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NinoxTableSchema } from "../ninox/types.js";

export const DECLARED_CATALOG_PATH = resolve(process.cwd(), "config", "declared-catalog.json");

export type DeclaredRepositoryStatus = "this-repo" | "verified-remote" | "unavailable";
export type DeclaredPresence = "in-schema" | "absent" | "unknown-id";
export type DeclaredFieldBinding = "ninox_field" | "documented" | "source-omission";

export interface DeclaredRepository {
  id: string;
  url: string;
  role: string;
  status: DeclaredRepositoryStatus;
  reason: string | null;
}

export interface DeclaredField {
  reportField: string;
  tableId: string;
  fieldId: string;
  sensitive: boolean;
  presence: DeclaredPresence;
  binding: DeclaredFieldBinding;
}

export interface DeclaredTable {
  report: string;
  ninoxName: string;
  tableId: string | null;
  grain: string;
  presence: DeclaredPresence;
  scannedName: string | null;
  fields: DeclaredField[];
}

export interface DeclaredCatalogView {
  sourceLabel: string;
  sourceUrl: string;
  schemaVersion: string;
  kitPackageVersion: string;
  schemaVerifiedAt: string;
  repositories: DeclaredRepository[];
  tables: DeclaredTable[];
  tableIds: string[];
  joinRules: string[];
  notes: string[];
  presentTableCount: number;
  absentTableCount: number;
  unknownTableCount: number;
  issue: string | null;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export function emptyDeclaredCatalog(issue: string | null = null): DeclaredCatalogView {
  return {
    sourceLabel: "Unknown",
    sourceUrl: "Unknown",
    schemaVersion: "Unknown",
    kitPackageVersion: "Unknown",
    schemaVerifiedAt: "Unknown",
    repositories: [],
    tables: [],
    tableIds: [],
    joinRules: [],
    notes: [],
    presentTableCount: 0,
    absentTableCount: 0,
    unknownTableCount: 0,
    issue,
  };
}

export function reconcileDeclaredCatalog(raw: unknown, schema: NinoxTableSchema[] = []): DeclaredCatalogView {
  const root = record(raw);
  if (!root) return emptyDeclaredCatalog("Declared catalog config could not be parsed");
  const source = record(root.source) ?? {};
  const tablesById = new Map(schema.flatMap((table) => typeof table.id === "string" ? [[table.id, table]] as const : []));
  const fieldKeys = new Set(schema.flatMap((table) => {
    if (typeof table.id !== "string" || !Array.isArray(table.fields)) return [];
    return table.fields.flatMap((field) => field && typeof field === "object" && "id" in field && typeof field.id === "string" ? [`${table.id}:${field.id}`] : []);
  }));

  const tables = (Array.isArray(root.tables) ? root.tables : []).flatMap((item) => {
    const table = record(item);
    if (!table) return [];
    const tableId = typeof table.tableId === "string" && table.tableId.trim() ? table.tableId.trim() : null;
    const scanned = tableId ? tablesById.get(tableId) : undefined;
    const presence: DeclaredPresence = tableId ? scanned ? "in-schema" : "absent" : "unknown-id";
    const fields = (Array.isArray(table.fields) ? table.fields : []).flatMap((rawField) => {
      const field = record(rawField);
      if (!field) return [];
      const fieldTableId = text(field.tableId);
      const fieldId = text(field.fieldId);
      if (!fieldTableId || !fieldId) return [];
      const binding = field.binding === "documented" || field.binding === "source-omission" ? field.binding : "ninox_field";
      return [{
        reportField: text(field.reportField) || "Unknown",
        tableId: fieldTableId,
        fieldId,
        sensitive: field.sensitive === true,
        presence: fieldKeys.has(`${fieldTableId}:${fieldId}`) ? "in-schema" as const : "absent" as const,
        binding,
      } satisfies DeclaredField];
    });
    return [{
      report: text(table.report) || "Unknown",
      ninoxName: text(table.ninoxName) || "Unknown",
      tableId,
      grain: text(table.grain),
      presence,
      scannedName: typeof scanned?.name === "string" ? scanned.name : null,
      fields,
    } satisfies DeclaredTable];
  });

  const repositories = (Array.isArray(root.repositories) ? root.repositories : []).flatMap((item) => {
    const repo = record(item);
    if (!repo) return [];
    const status = repo.status === "this-repo" || repo.status === "verified-remote" || repo.status === "unavailable" ? repo.status : "unavailable";
    return [{
      id: text(repo.id) || "Unknown",
      url: text(repo.url) || "Unknown",
      role: text(repo.role),
      status,
      reason: text(repo.reason) || null,
    } satisfies DeclaredRepository];
  });

  const tableIds = [...new Set(tables.flatMap((table) => table.tableId ? [table.tableId] : []))];
  return {
    sourceLabel: text(source.label) || "Lightning Transportation Data Reporting Kit",
    sourceUrl: text(source.url) || "https://github.com/lightningtransport/data-reporting-kit",
    schemaVersion: text(source.schemaVersion) || "Unknown",
    kitPackageVersion: text(source.kitPackageVersion) || "Unknown",
    schemaVerifiedAt: text(source.schemaVerifiedAt) || "Unknown",
    repositories,
    tables,
    tableIds,
    joinRules: strings(root.joinRules),
    notes: strings(root.notes),
    presentTableCount: tables.filter((table) => table.presence === "in-schema").length,
    absentTableCount: tables.filter((table) => table.presence === "absent").length,
    unknownTableCount: tables.filter((table) => table.presence === "unknown-id").length,
    issue: null,
  };
}

export async function readDeclaredCatalog(
  schema: NinoxTableSchema[] = [],
  path = DECLARED_CATALOG_PATH,
): Promise<DeclaredCatalogView> {
  try {
    return reconcileDeclaredCatalog(JSON.parse(await readFile(path, "utf8")), schema);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return emptyDeclaredCatalog("config/declared-catalog.json is missing");
    return emptyDeclaredCatalog("Declared catalog config could not be read");
  }
}

export function declaredAnchorTableId(declared: DeclaredCatalogView, fallback = "E"): string {
  return declared.tables.find((table) => table.tableId === fallback && table.presence === "in-schema")?.tableId
    ?? declared.tables.find((table) => table.presence === "in-schema" && table.tableId)?.tableId
    ?? fallback;
}

export function declaredTablesForId(declared: DeclaredCatalogView | undefined, tableId: string) {
  return declared?.tables.filter((table) => table.tableId === tableId) ?? [];
}
