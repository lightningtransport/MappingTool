import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NinoxTableSchema, UnknownObject } from "../ninox/types.js";
import type { DatabaseScanResult } from "./scanDatabase.js";
import type { Relationship } from "./relationshipAnalyzer.js";

export interface StructuralField {
  id: string;
  name: string;
  type: string;
  referenceToTable: string;
  referenceFromTable: string;
  referenceFromField: string;
  reverseField: string;
}

export interface StructuralTable {
  id: string;
  name: string;
  fields: StructuralField[];
}

export interface StructuralRelationship {
  sourceTableId: string;
  sourceFieldId: string;
  targetTableId: string;
  targetField: string;
  reverseField: string;
  source: "ninox" | "detected" | "unknown";
  confidence: number;
}

export interface StructuralSnapshot {
  version: 1;
  scannedAt: string;
  tables: StructuralTable[];
  relationships: StructuralRelationship[];
}

export interface NamedIdentity {
  id: string;
  name: string;
}

export interface RenamedIdentity extends NamedIdentity {
  previousName: string;
}

export interface FieldIdentity extends NamedIdentity {
  tableId: string;
  tableName: string;
}

export interface RenamedField extends FieldIdentity {
  previousName: string;
}

export interface ChangedField extends FieldIdentity {
  changedProperties: string[];
}

export interface ChangedRelationship extends StructuralRelationship {
  changedProperties: string[];
}

export interface StructuralChangeSummary {
  total: number;
  tablesAdded: number;
  tablesRemoved: number;
  tablesRenamed: number;
  fieldsAdded: number;
  fieldsRemoved: number;
  fieldsRenamed: number;
  fieldsChanged: number;
  relationshipsAdded: number;
  relationshipsRemoved: number;
  relationshipsChanged: number;
}

export interface StructuralDiff {
  version: 1;
  generatedAt: string;
  baseline: boolean;
  fromScannedAt: string | null;
  toScannedAt: string;
  summary: StructuralChangeSummary;
  tables: { added: NamedIdentity[]; removed: NamedIdentity[]; renamed: RenamedIdentity[] };
  fields: { added: FieldIdentity[]; removed: FieldIdentity[]; renamed: RenamedField[]; changed: ChangedField[] };
  relationships: { added: StructuralRelationship[]; removed: StructuralRelationship[]; changed: ChangedRelationship[] };
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Unknown";
}

function asObject(value: unknown): UnknownObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownObject : null;
}

function fields(table: NinoxTableSchema): StructuralField[] {
  if (!Array.isArray(table.fields)) return [];
  return table.fields.flatMap((value) => {
    const field = asObject(value);
    if (!field) return [];
    return [{
      id: text(field.id),
      name: text(field.name),
      type: text(field.type),
      referenceToTable: text(field.referenceToTable),
      referenceFromTable: text(field.referenceFromTable),
      referenceFromField: text(field.referenceFromField),
      reverseField: text(field.reverseField),
    }];
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function structuralRelationship(relationship: Relationship): StructuralRelationship {
  return {
    sourceTableId: relationship.sourceTableId,
    sourceFieldId: relationship.sourceFieldId,
    targetTableId: relationship.targetTableId,
    targetField: relationship.targetField,
    reverseField: relationship.reverseField,
    source: relationship.source,
    confidence: relationship.confidence,
  };
}

function relationshipKey(relationship: StructuralRelationship): string {
  return `${relationship.sourceTableId}\u0000${relationship.sourceFieldId}\u0000${relationship.targetTableId}`;
}

function fieldKey(tableId: string, fieldId: string): string {
  return `${tableId}\u0000${fieldId}`;
}

export function buildStructuralSnapshot(result: Pick<DatabaseScanResult, "scannedAt" | "tables" | "relationships">): StructuralSnapshot {
  return {
    version: 1,
    scannedAt: result.scannedAt,
    tables: result.tables.map((table) => ({ id: text(table.id), name: text(table.name), fields: fields(table) })).sort((a, b) => a.id.localeCompare(b.id)),
    relationships: result.relationships.relationships.map(structuralRelationship).sort((a, b) => relationshipKey(a).localeCompare(relationshipKey(b))),
  };
}

function emptyDiff(toScannedAt: string): StructuralDiff {
  const summary: StructuralChangeSummary = {
    total: 0,
    tablesAdded: 0,
    tablesRemoved: 0,
    tablesRenamed: 0,
    fieldsAdded: 0,
    fieldsRemoved: 0,
    fieldsRenamed: 0,
    fieldsChanged: 0,
    relationshipsAdded: 0,
    relationshipsRemoved: 0,
    relationshipsChanged: 0,
  };
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseline: true,
    fromScannedAt: null,
    toScannedAt,
    summary,
    tables: { added: [], removed: [], renamed: [] },
    fields: { added: [], removed: [], renamed: [], changed: [] },
    relationships: { added: [], removed: [], changed: [] },
  };
}

export function diffStructuralSnapshots(previous: StructuralSnapshot | null, current: StructuralSnapshot): StructuralDiff {
  if (!previous) return emptyDiff(current.scannedAt);
  const previousTables = new Map(previous.tables.map((table) => [table.id, table]));
  const currentTables = new Map(current.tables.map((table) => [table.id, table]));
  const tableAdded = current.tables.filter((table) => !previousTables.has(table.id)).map(({ id, name }) => ({ id, name }));
  const tableRemoved = previous.tables.filter((table) => !currentTables.has(table.id)).map(({ id, name }) => ({ id, name }));
  const tableRenamed = current.tables.flatMap((table) => {
    const before = previousTables.get(table.id);
    return before && before.name !== table.name ? [{ id: table.id, name: table.name, previousName: before.name }] : [];
  });

  const previousFields = new Map(previous.tables.flatMap((table) => table.fields.map((field) => [fieldKey(table.id, field.id), { table, field }] as const)));
  const currentFields = new Map(current.tables.flatMap((table) => table.fields.map((field) => [fieldKey(table.id, field.id), { table, field }] as const)));
  const fieldIdentity = (table: StructuralTable, field: StructuralField): FieldIdentity => ({ tableId: table.id, tableName: table.name, id: field.id, name: field.name });
  const fieldAdded = [...currentFields.entries()].filter(([key]) => !previousFields.has(key)).map(([, value]) => fieldIdentity(value.table, value.field));
  const fieldRemoved = [...previousFields.entries()].filter(([key]) => !currentFields.has(key)).map(([, value]) => fieldIdentity(value.table, value.field));
  const fieldRenamed: RenamedField[] = [];
  const fieldChanged: ChangedField[] = [];
  for (const [key, value] of currentFields) {
    const before = previousFields.get(key);
    if (!before) continue;
    if (before.field.name !== value.field.name) fieldRenamed.push({ ...fieldIdentity(value.table, value.field), previousName: before.field.name });
    const changedProperties = (["type", "referenceToTable", "referenceFromTable", "referenceFromField", "reverseField"] as const)
      .filter((property) => before.field[property] !== value.field[property]);
    if (changedProperties.length) fieldChanged.push({ ...fieldIdentity(value.table, value.field), changedProperties });
  }

  const previousRelationships = new Map(previous.relationships.map((relationship) => [relationshipKey(relationship), relationship]));
  const currentRelationships = new Map(current.relationships.map((relationship) => [relationshipKey(relationship), relationship]));
  const relationshipAdded = current.relationships.filter((relationship) => !previousRelationships.has(relationshipKey(relationship)));
  const relationshipRemoved = previous.relationships.filter((relationship) => !currentRelationships.has(relationshipKey(relationship)));
  const relationshipChanged: ChangedRelationship[] = [];
  for (const relationship of current.relationships) {
    const before = previousRelationships.get(relationshipKey(relationship));
    if (!before) continue;
    const changedProperties = (["targetField", "reverseField", "source", "confidence"] as const)
      .filter((property) => before[property] !== relationship[property]);
    if (changedProperties.length) relationshipChanged.push({ ...relationship, changedProperties });
  }

  const summary: StructuralChangeSummary = {
    total: tableAdded.length + tableRemoved.length + tableRenamed.length + fieldAdded.length + fieldRemoved.length + fieldRenamed.length + fieldChanged.length + relationshipAdded.length + relationshipRemoved.length + relationshipChanged.length,
    tablesAdded: tableAdded.length,
    tablesRemoved: tableRemoved.length,
    tablesRenamed: tableRenamed.length,
    fieldsAdded: fieldAdded.length,
    fieldsRemoved: fieldRemoved.length,
    fieldsRenamed: fieldRenamed.length,
    fieldsChanged: fieldChanged.length,
    relationshipsAdded: relationshipAdded.length,
    relationshipsRemoved: relationshipRemoved.length,
    relationshipsChanged: relationshipChanged.length,
  };
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseline: false,
    fromScannedAt: previous.scannedAt,
    toScannedAt: current.scannedAt,
    summary,
    tables: { added: tableAdded, removed: tableRemoved, renamed: tableRenamed },
    fields: { added: fieldAdded, removed: fieldRemoved, renamed: fieldRenamed, changed: fieldChanged },
    relationships: { added: relationshipAdded, removed: relationshipRemoved, changed: relationshipChanged },
  };
}

export async function readCurrentStructuralSnapshot(outputRoot = resolve(process.cwd(), "output")): Promise<StructuralSnapshot | null> {
  try {
    const [schemaText, relationshipsText] = await Promise.all([
      readFile(resolve(outputRoot, "schema.json"), "utf8"),
      readFile(resolve(outputRoot, "relationships.json"), "utf8"),
    ]);
    const schema = JSON.parse(schemaText) as { scannedAt: string; tables: NinoxTableSchema[] };
    const relationships = JSON.parse(relationshipsText) as { relationships: Relationship[] };
    return buildStructuralSnapshot({ scannedAt: schema.scannedAt, tables: schema.tables, relationships: { scannedAt: schema.scannedAt, relationships: relationships.relationships, counts: { ninox: 0, detected: 0, unknown: 0 } } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function snapshotFilename(scannedAt: string): string {
  return `${scannedAt.replace(/[^0-9A-Za-z_-]+/g, "-")}.json`;
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export async function archiveStructuralSnapshot(snapshot: StructuralSnapshot, outputRoot = resolve(process.cwd(), "output")): Promise<string> {
  const snapshotRoot = resolve(outputRoot, "history", "snapshots");
  await mkdir(snapshotRoot, { recursive: true });
  const outputPath = resolve(snapshotRoot, snapshotFilename(snapshot.scannedAt));
  await writeJsonAtomic(outputPath, snapshot);
  return outputPath;
}

export async function writeStructuralHistory(
  snapshot: StructuralSnapshot,
  diff: StructuralDiff,
  outputRoot = resolve(process.cwd(), "output"),
): Promise<void> {
  const historyRoot = resolve(outputRoot, "history");
  await mkdir(historyRoot, { recursive: true });
  await archiveStructuralSnapshot(snapshot, outputRoot);
  await writeJsonAtomic(resolve(historyRoot, "latest-snapshot.json"), snapshot);
  await writeJsonAtomic(resolve(historyRoot, "latest-diff.json"), diff);
}
