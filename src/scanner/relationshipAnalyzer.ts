import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ReadOnlyNinoxClient } from "../ninox/client.js";
import type { NinoxTableSchema, UnknownObject } from "../ninox/types.js";

export type RelationshipSource = "ninox" | "detected" | "unknown";

export interface Relationship {
  sourceTable: string;
  sourceTableId: string;
  sourceField: string;
  sourceFieldId: string;
  targetTable: string;
  targetTableId: string;
  targetField: string;
  reverseField: string;
  source: RelationshipSource;
  confidence: number;
}

export interface RelationshipResult {
  scannedAt: string;
  relationships: Relationship[];
  counts: { ninox: number; detected: number; unknown: number };
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Unknown";
}

function objects(value: unknown): UnknownObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is UnknownObject => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

export function analyzeRelationships(table: NinoxTableSchema, tables: NinoxTableSchema[]): RelationshipResult {
  const tableId = text(table.id);
  const tableName = text(table.name);
  const byId = new Map(tables.map((item) => [text(item.id), text(item.name)]));
  const relationships: Relationship[] = [];

  for (const field of objects(table.fields)) {
    if (field.type !== "ref") continue;
    const targetId = text(field.referenceToTable);
    const targetName = byId.get(targetId) ?? "Unknown";
    const explicit = targetId !== "Unknown";
    relationships.push({
      sourceTable: tableName,
      sourceTableId: tableId,
      sourceField: text(field.name),
      sourceFieldId: text(field.id),
      targetTable: targetName,
      targetTableId: targetId,
      targetField: "id",
      reverseField: text(field.reverseField),
      source: explicit ? "ninox" : "unknown",
      confidence: explicit ? 1 : 0,
    });
  }

  const counts = {
    ninox: relationships.filter((item) => item.source === "ninox").length,
    detected: relationships.filter((item) => item.source === "detected").length,
    unknown: relationships.filter((item) => item.source === "unknown").length,
  };
  return { scannedAt: new Date().toISOString(), relationships, counts };
}

export async function writeRelationshipsOutput(
  result: RelationshipResult,
  outputRoot = resolve(process.cwd(), "output"),
): Promise<string> {
  const outputPath = resolve(outputRoot, "relationships.json");
  await mkdir(outputRoot, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return outputPath;
}

export async function discoverRelationships(client: ReadOnlyNinoxClient, tableId = "E"): Promise<RelationshipResult> {
  const [table, tables] = await Promise.all([client.getTable(tableId), client.getTables()]);
  return analyzeRelationships(table, tables);
}
