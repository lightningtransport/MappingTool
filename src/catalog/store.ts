import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CATALOG_SCHEMA_VERSION,
  type CatalogAnnotations,
  type CatalogLoadResult,
  type Criticality,
  type ConsumerKind,
  type FieldRole,
  type ImportCandidate,
  type KnowledgeProvenance,
  type RelationshipCardinality,
  type RelationshipDecision,
  type ReviewStatus,
} from "./types.js";

export const DEFAULT_CATALOG_ROOT = resolve(process.cwd(), "output", "review");
export const CATALOG_FILE = "annotations.json";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

const REVIEW_STATUSES: readonly ReviewStatus[] = ["active", "obsolete", "temporary", "duplicate", "merge-candidate", "unknown"];
const CRITICALITIES: readonly Criticality[] = ["low", "medium", "high", "unknown"];
const FIELD_ROLES: readonly FieldRole[] = ["business-key", "dimension", "measure", "status", "date", "reference", "sensitive", "unknown"];
const RELATIONSHIP_DECISIONS: readonly RelationshipDecision[] = ["confirmed", "rejected", "pending"];
const CARDINALITIES: readonly RelationshipCardinality[] = ["one-to-one", "one-to-many", "many-to-one", "many-to-many", "unknown"];
const CONSUMER_KINDS: readonly ConsumerKind[] = ["app", "report", "api", "job"];

export function emptyCatalog(now = new Date().toISOString()): CatalogAnnotations {
  return { schemaVersion: CATALOG_SCHEMA_VERSION, updatedAt: now, tables: {}, fields: {}, relationships: {}, consumers: {}, candidates: {} };
}

function provenance(value: unknown): KnowledgeProvenance {
  const item = record(value) ?? {};
  return {
    kind: item.kind === "external" ? "external" : "human",
    sourceId: string(item.sourceId, "local-review"),
    sourceLabel: string(item.sourceLabel, "Human review"),
    sourceVersion: typeof item.sourceVersion === "string" ? item.sourceVersion : null,
    verifiedAt: typeof item.verifiedAt === "string" ? item.verifiedAt : null,
    importedAt: typeof item.importedAt === "string" ? item.importedAt : null,
    contentHash: typeof item.contentHash === "string" ? item.contentHash : null,
  };
}

export function migrateCatalogAnnotations(value: unknown, now = new Date().toISOString()): CatalogAnnotations {
  const root = record(value);
  if (!root) throw new Error("Catalog annotations must be a JSON object");
  const version = root.schemaVersion ?? 0;
  if (version !== 0 && version !== CATALOG_SCHEMA_VERSION) throw new Error(`Unsupported catalog schema version: ${String(version)}`);
  const migrated = emptyCatalog(string(root.updatedAt, now));

  for (const [key, raw] of Object.entries(record(root.tables) ?? {})) {
    const item = record(raw);
    if (!item) continue;
    const tableId = string(item.tableId, key).trim();
    if (!tableId) continue;
    migrated.tables[tableId] = {
      tableId,
      description: string(item.description),
      status: enumValue(item.status, REVIEW_STATUSES, "unknown"),
      grain: string(item.grain),
      businessKeyFieldIds: stringList(item.businessKeyFieldIds),
      criticality: enumValue(item.criticality, CRITICALITIES, "unknown"),
      tags: stringList(item.tags),
      useFor: stringList(item.useFor),
      doNotUseFor: stringList(item.doNotUseFor),
      notes: string(item.notes),
      provenance: provenance(item.provenance),
      updatedAt: string(item.updatedAt, migrated.updatedAt),
    };
  }

  for (const [key, raw] of Object.entries(record(root.fields) ?? {})) {
    const item = record(raw);
    if (!item) continue;
    const [fallbackTable = "", fallbackField = ""] = key.split(":");
    const tableId = string(item.tableId, fallbackTable).trim();
    const fieldId = string(item.fieldId, fallbackField).trim();
    if (!tableId || !fieldId) continue;
    migrated.fields[`${tableId}:${fieldId}`] = {
      tableId, fieldId,
      description: string(item.description),
      role: enumValue(item.role, FIELD_ROLES, "unknown"),
      sensitive: item.sensitive === true,
      criticality: enumValue(item.criticality, CRITICALITIES, "unknown"),
      safeUse: string(item.safeUse),
      notes: string(item.notes),
      provenance: provenance(item.provenance),
      updatedAt: string(item.updatedAt, migrated.updatedAt),
    };
  }

  for (const [key, raw] of Object.entries(record(root.relationships) ?? {})) {
    const item = record(raw);
    if (!item) continue;
    const [fallbackSource = "", fallbackField = "", fallbackTarget = ""] = key.split(":");
    const sourceTableId = string(item.sourceTableId, fallbackSource).trim();
    const sourceFieldId = string(item.sourceFieldId, fallbackField).trim();
    const targetTableId = string(item.targetTableId, fallbackTarget).trim();
    if (!sourceTableId || !sourceFieldId || !targetTableId) continue;
    migrated.relationships[`${sourceTableId}:${sourceFieldId}:${targetTableId}`] = {
      sourceTableId, sourceFieldId, targetTableId,
      decision: enumValue(item.decision, RELATIONSHIP_DECISIONS, "pending"),
      cardinality: enumValue(item.cardinality, CARDINALITIES, "unknown"),
      joinRule: string(item.joinRule),
      notes: string(item.notes),
      provenance: provenance(item.provenance),
      updatedAt: string(item.updatedAt, migrated.updatedAt),
    };
  }

  for (const [key, raw] of Object.entries(record(root.consumers) ?? {})) {
    const item = record(raw);
    if (!item) continue;
    const id = string(item.id, key).trim();
    if (!id) continue;
    migrated.consumers[id] = {
      id,
      name: string(item.name, id),
      kind: enumValue(item.kind, CONSUMER_KINDS, "report"),
      purpose: string(item.purpose),
      tableIds: stringList(item.tableIds),
      fieldKeys: stringList(item.fieldKeys),
      filters: stringList(item.filters),
      joins: stringList(item.joins),
      freshnessLimitations: stringList(item.freshnessLimitations),
      provenance: provenance(item.provenance),
      updatedAt: string(item.updatedAt, migrated.updatedAt),
    };
  }

  for (const [key, raw] of Object.entries(record(root.candidates) ?? {})) {
    const item = record(raw);
    if (!item) continue;
    const id = string(item.id, key).trim();
    const kind = item.kind === "field" || item.kind === "consumer" ? item.kind : "table";
    const tableId = string(item.tableId).trim();
    if (!id || !tableId) continue;
    migrated.candidates[id] = {
      id, kind, tableId,
      fieldId: typeof item.fieldId === "string" ? item.fieldId : null,
      decision: item.decision === "accepted" || item.decision === "rejected" ? item.decision : "pending",
      payload: record(item.payload) as ImportCandidate["payload"] ?? {},
      provenance: provenance(item.provenance),
      createdAt: string(item.createdAt, migrated.updatedAt),
      decidedAt: typeof item.decidedAt === "string" ? item.decidedAt : null,
    };
  }

  return migrated;
}

export async function readCatalog(root = DEFAULT_CATALOG_ROOT): Promise<CatalogLoadResult> {
  try {
    const raw = await readFile(resolve(root, CATALOG_FILE), "utf8");
    return { catalog: migrateCatalogAnnotations(JSON.parse(raw)), issue: null };
  } catch (error) {
    const code = record(error)?.code;
    if (code === "ENOENT") return { catalog: emptyCatalog(), issue: null };
    const message = error instanceof Error ? error.message : "Unknown catalog read error";
    return { catalog: emptyCatalog(), issue: `Catalog annotations could not be loaded: ${message}` };
  }
}

let mutationQueue: Promise<void> = Promise.resolve();

export async function mutateCatalog(
  mutation: (catalog: CatalogAnnotations) => CatalogAnnotations | Promise<CatalogAnnotations>,
  root = DEFAULT_CATALOG_ROOT,
): Promise<CatalogAnnotations> {
  let result = emptyCatalog();
  let failure: unknown;
  mutationQueue = mutationQueue.then(async () => {
    try {
      const loaded = await readCatalog(root);
      if (loaded.issue) throw new Error(loaded.issue);
      result = await mutation(structuredClone(loaded.catalog));
      result.schemaVersion = CATALOG_SCHEMA_VERSION;
      result.updatedAt = new Date().toISOString();
      await mkdir(root, { recursive: true });
      const destination = resolve(root, CATALOG_FILE);
      const temporary = resolve(root, `${CATALOG_FILE}.tmp-${process.pid}-${Date.now()}`);
      await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      await rename(temporary, destination);
    } catch (error) {
      failure = error;
    }
  });
  await mutationQueue;
  if (failure) throw failure;
  return result;
}
