import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { NinoxTableSchema } from "../ninox/types.js";
import type { CatalogAnnotations, ImportCandidate, ImportCandidatePayload, KnowledgeProvenance } from "./types.js";

type UnknownRecord = Record<string, unknown>;
export interface ReportingKitMetadata {
  schemaVersion: string;
  schemaVerifiedAt: string;
  globalGuidance: UnknownRecord;
  tables: UnknownRecord;
}
export interface CandidateBuildResult { candidates: ImportCandidate[]; ignoredMappings: string[] }

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function explicitTableId(ninoxSource: unknown): string | null {
  if (typeof ninoxSource !== "string") return null;
  const match = ninoxSource.match(/\(([A-Z0-9]+)\)/);
  return match?.[1] ?? null;
}

function explicitFieldIdentity(value: unknown): { tableId: string; fieldId: string } | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^([A-Z0-9]+)\.([A-Z0-9]+)$/);
  return match ? { tableId: match[1]!, fieldId: match[2]! } : null;
}

function candidate(
  kind: ImportCandidate["kind"],
  tableId: string,
  fieldId: string | null,
  payload: ImportCandidatePayload,
  source: Omit<KnowledgeProvenance, "contentHash">,
  sourceHash: string,
  now: string,
): ImportCandidate {
  const contentHash = sha(`${sourceHash}:${JSON.stringify(payload)}`);
  return {
    id: `data-reporting-kit:${kind}:${tableId}${fieldId ? `:${fieldId}` : ""}`,
    kind, tableId, fieldId, decision: "pending", payload,
    provenance: { ...source, contentHash },
    createdAt: now,
    decidedAt: null,
  };
}

export function buildReportingKitCandidates(
  metadata: ReportingKitMetadata,
  schema: NinoxTableSchema[],
  sourceHash: string,
  now = new Date().toISOString(),
): CandidateBuildResult {
  const tableIds = new Set(schema.flatMap((table) => typeof table.id === "string" ? [table.id] : []));
  const fieldKeys = new Set(schema.flatMap((table) => {
    if (typeof table.id !== "string" || !Array.isArray(table.fields)) return [];
    return table.fields.flatMap((field) => field && typeof field === "object" && "id" in field && typeof field.id === "string" ? [`${table.id}:${field.id}`] : []);
  }));
  const source = {
    kind: "external" as const,
    sourceId: "data-reporting-kit",
    sourceLabel: "Lightning Transportation Data Reporting Kit",
    sourceVersion: metadata.schemaVersion,
    verifiedAt: metadata.schemaVerifiedAt,
    importedAt: now,
  };
  const candidates: ImportCandidate[] = [];
  const ignoredMappings: string[] = [];
  for (const [reportName, rawTable] of Object.entries(metadata.tables)) {
    const table = record(rawTable);
    if (!table) continue;
    const tableId = explicitTableId(table.ninox_source);
    if (!tableId || !tableIds.has(tableId)) {
      ignoredMappings.push(`${reportName}: missing or unavailable explicit Ninox table ID`);
      continue;
    }
    candidates.push(candidate("table", tableId, null, { table: {
      description: typeof table.row_grain === "string" ? table.row_grain : "",
      grain: typeof table.row_grain === "string" ? table.row_grain : "",
      status: "active",
      tags: ["reporting-kit", reportName],
      useFor: strings(table.use_for),
      doNotUseFor: strings(table.do_not_use_for),
      notes: strings(table.calculation_rules).join("\n"),
    } }, source, sourceHash, now));

    const fields = record(table.fields) ?? {};
    for (const [externalName, rawField] of Object.entries(fields)) {
      const field = record(rawField);
      if (!field) continue;
      const identity = explicitFieldIdentity(field.ninox_field);
      if (!identity) continue;
      if (!fieldKeys.has(`${identity.tableId}:${identity.fieldId}`)) {
        ignoredMappings.push(`${reportName}.${externalName}: explicit Ninox field is absent from current schema`);
        continue;
      }
      candidates.push(candidate("field", identity.tableId, identity.fieldId, { field: {
        description: typeof field.meaning === "string" ? field.meaning : "",
        sensitive: field.sensitive === true,
        role: field.sensitive === true ? "sensitive" : "unknown",
        notes: `Reporting field: ${externalName}`,
      } }, source, sourceHash, now));
    }

    candidates.push(candidate("consumer", tableId, null, { consumer: {
      id: `reporting-kit:${reportName}`,
      name: reportName,
      kind: "api",
      purpose: strings(table.use_for).join("; "),
      tableIds: [tableId],
      fieldKeys: [],
      filters: [],
      joins: strings(metadata.globalGuidance.join_rules),
      freshnessLimitations: typeof metadata.globalGuidance.freshness === "string" ? [metadata.globalGuidance.freshness] : [],
    } }, source, sourceHash, now));
  }
  return { candidates, ignoredMappings };
}

export function mergeImportCandidates(catalog: CatalogAnnotations, incoming: ImportCandidate[]): CatalogAnnotations {
  for (const next of incoming) {
    const previous = catalog.candidates[next.id];
    if (previous && previous.provenance.contentHash === next.provenance.contentHash) {
      catalog.candidates[next.id] = { ...next, decision: previous.decision, createdAt: previous.createdAt, decidedAt: previous.decidedAt };
      continue;
    }
    catalog.candidates[next.id] = next;
  }
  return catalog;
}

export async function loadReportingKitMetadata(root: string): Promise<{ metadata: ReportingKitMetadata; sourceHash: string }> {
  const metadataPath = resolve(root, "supabase", "functions", "agent-reporting", "metadata.ts");
  const source = await readFile(metadataPath, "utf8");
  const moduleUrl = `${pathToFileURL(metadataPath).href}?catalog-import=${Date.now()}`;
  const loaded = await import(moduleUrl) as UnknownRecord;
  const schemaVersion = typeof loaded.SCHEMA_VERSION === "string" ? loaded.SCHEMA_VERSION : "Unknown";
  const schemaVerifiedAt = typeof loaded.SCHEMA_VERIFIED_AT === "string" ? loaded.SCHEMA_VERIFIED_AT : "Unknown";
  const tables = record(loaded.TABLES);
  const globalGuidance = record(loaded.GLOBAL_GUIDANCE);
  if (!tables || !globalGuidance) throw new Error("Reporting kit metadata exports are unavailable");
  return { metadata: { schemaVersion, schemaVerifiedAt, tables, globalGuidance }, sourceHash: sha(source) };
}
