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
  metadata?: {
    forwardType: "ref";
    reverseType: "rev" | "Unknown";
    reverseValidated: boolean;
  };
}

export interface RelationshipResult {
  scannedAt: string;
  relationships: Relationship[];
  counts: { ninox: number; detected: number; unknown: number };
}

export interface SampledTable {
  tableId: string;
  tableName: string;
  records: UnknownObject[];
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Unknown";
}

function asObject(value: unknown): UnknownObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownObject
    : {};
}

function objects(value: unknown): UnknownObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is UnknownObject => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

export function analyzeRelationships(table: NinoxTableSchema, tables: NinoxTableSchema[]): RelationshipResult {
  const tableId = text(table.id);
  const tableName = text(table.name);
  const byId = new Map(tables.map((item) => [text(item.id), item]));
  const relationships: Relationship[] = [];

  for (const field of objects(table.fields)) {
    if (field.type !== "ref") continue;
    const targetId = text(field.referenceToTable);
    const target = byId.get(targetId);
    const reverse = objects(target?.fields).find((candidate) => (
      candidate.type === "rev"
      && text(candidate.referenceFromTable) === tableId
      && text(candidate.referenceFromField) === text(field.id)
    ));
    const resolved = targetId !== "Unknown" && Boolean(target);
    relationships.push({
      sourceTable: tableName,
      sourceTableId: tableId,
      sourceField: text(field.name),
      sourceFieldId: text(field.id),
      targetTable: target ? text(target.name) : "Unknown",
      targetTableId: targetId,
      targetField: "id",
      reverseField: reverse ? text(reverse.id) : text(field.reverseField),
      source: resolved ? "ninox" : "unknown",
      confidence: resolved ? 1 : 0,
      metadata: {
        forwardType: "ref",
        reverseType: reverse ? "rev" : "Unknown",
        reverseValidated: Boolean(reverse),
      },
    });
  }

  const counts = {
    ninox: relationships.filter((item) => item.source === "ninox").length,
    detected: relationships.filter((item) => item.source === "detected").length,
    unknown: relationships.filter((item) => item.source === "unknown").length,
  };
  return { scannedAt: new Date().toISOString(), relationships, counts };
}

function scalarIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item) => typeof item === "number" || (typeof item === "string" && /^\d+$/.test(item)))
    .map(String);
}

function comparableName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
}

export function detectRelationshipsFromSamples(
  tables: NinoxTableSchema[],
  samples: SampledTable[],
): RelationshipResult {
  const sampleIds = new Map(samples.map((sample) => [sample.tableId, new Set(sample.records.map((record) => String(record.id)).filter((id) => id !== "undefined"))]));
  const relationships: Relationship[] = [];
  for (const table of tables) {
    const sourceTableId = text(table.id);
    const sourceTable = text(table.name);
    const sample = samples.find((item) => item.tableId === sourceTableId);
    if (!sample) continue;
    for (const field of objects(table.fields)) {
      if (field.type === "ref" || field.type === "rev") continue;
      const values = [...new Set(sample.records.flatMap((record) => scalarIds(asObject(record.fields)[String(field.name)])))];
      if (values.length < 2) continue;
      for (const target of tables) {
        const targetTableId = text(target.id);
        if (targetTableId === sourceTableId) continue;
        const fieldName = comparableName(text(field.name));
        const targetName = comparableName(text(target.name));
        if (!fieldName || fieldName !== targetName) continue;
        const ids = sampleIds.get(targetTableId);
        const overlap = values.filter((value) => ids?.has(value)).length;
        if (overlap < 2) continue;
        relationships.push({
          sourceTable,
          sourceTableId,
          sourceField: text(field.name),
          sourceFieldId: text(field.id),
          targetTable: text(target.name),
          targetTableId,
          targetField: "id",
          reverseField: "Unknown",
          source: "detected",
          confidence: Math.min(0.99, 0.5 + overlap / values.length / 2),
        });
      }
    }
  }
  return {
    scannedAt: new Date().toISOString(),
    relationships,
    counts: { ninox: 0, detected: relationships.length, unknown: 0 },
  };
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
