import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ReadOnlyNinoxClient } from "../ninox/client.js";
import type { NinoxTableSchema, UnknownObject } from "../ninox/types.js";

export interface FieldMetadata extends UnknownObject {
  id: string;
  name: string;
  type: string;
  relationship: string;
  relatedTable: string;
  raw: UnknownObject;
}

export interface TableMetadataResult {
  scannedAt: string;
  tableId: string;
  tableName: string;
  fieldCount: number;
  fields: FieldMetadata[];
}

function asObject(value: unknown): UnknownObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownObject
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Unknown";
}

export function normalizeTableMetadata(table: NinoxTableSchema, tableId: string): TableMetadataResult {
  const rawFields = Array.isArray(table.fields) ? table.fields : [];
  const fields = rawFields.map((value) => {
    const raw = asObject(value);
    return {
      id: text(raw.id),
      name: text(raw.name),
      type: text(raw.type),
      relationship: text(raw.relationship ?? raw.relation ?? raw.kind),
      relatedTable: text(raw.relatedTable ?? raw.targetTable ?? raw.table),
      raw,
    };
  });
  return {
    scannedAt: new Date().toISOString(),
    tableId,
    tableName: text(table.name),
    fieldCount: fields.length,
    fields,
  };
}

export async function inspectMetadata(
  client: ReadOnlyNinoxClient,
  tableId = "E",
): Promise<TableMetadataResult> {
  return normalizeTableMetadata(await client.getTable(tableId), tableId);
}

export async function writeMetadataOutput(
  result: TableMetadataResult,
  outputRoot = resolve(process.cwd(), "output"),
): Promise<string> {
  const outputDir = resolve(outputRoot, "metadata");
  const outputPath = resolve(outputDir, "trucksdb.json");
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return outputPath;
}
