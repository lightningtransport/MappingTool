import type { ShopMapData } from "./types.js";
import type { DataQualityReport } from "../src/scanner/dataQuality.js";
import type { StructuralChangeSummary, StructuralDiff } from "../src/scanner/scanHistory.js";
import type { DeclaredCatalogView } from "../src/catalog/declaredCatalog.js";
import type { CatalogAnnotations, CatalogCoverage, CatalogOrphan } from "../src/catalog/types.js";

export type RelationshipSource = "ninox" | "detected" | "unknown";
export type Direction = "all" | "incoming" | "outgoing";
export type ExplorerScope = "all" | "shop" | "reporting";
export type FieldMetadataState = "available" | "partial" | "unknown";

export interface ExplorerChoice {
  id: string;
  caption: string;
}

export interface ExplorerField {
  id: string;
  name: string;
  type: string;
  choices: ExplorerChoice[];
  referenceToTable: string;
  referenceFromTable: string;
  referenceFromField: string;
  reverseField: string;
  metadataState: FieldMetadataState;
}

export interface ExplorerTable {
  id: string;
  name: string;
  relationshipCount: number;
  fields: ExplorerField[];
}

export interface ExplorerRelationship {
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
  provenance: string;
  raw: Record<string, unknown>;
}

export interface ExplorerData {
  generatedAt: string;
  tables: ExplorerTable[];
  relationships: ExplorerRelationship[];
  shopMap: ShopMapData;
  summary: { tableCount: number; relationshipCount: number; fieldCount: number; sampledRecords: number };
  quality: DataQualityReport;
  history: ExplorerHistory[];
  catalog: {
    annotations: CatalogAnnotations;
    coverage: CatalogCoverage;
    orphans: CatalogOrphan[];
    issue: string | null;
  };
  loadIssue?: string | null;
  declared?: DeclaredCatalogView;
}

export interface CatalogSearchResult {
  kind: "table" | "field" | "consumer" | "declared";
  tableId: string;
  fieldId: string | null;
  label: string;
  detail: string;
  provenance: "Ninox evidence" | "Human reviewed" | "External candidate";
}

export function searchCatalog(data: ExplorerData, query: string, limit = 60): CatalogSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const results: CatalogSearchResult[] = [];
  for (const table of data.tables) {
    const review = data.catalog.annotations.tables[table.id];
    const tableText = [table.name, table.id, review?.description, review?.grain, ...(review?.tags ?? []), ...(review?.useFor ?? []), ...(review?.doNotUseFor ?? [])].filter(Boolean).join(" ").toLowerCase();
    if (tableText.includes(normalized)) results.push({ kind: "table", tableId: table.id, fieldId: null, label: table.name, detail: review?.description || `Table ${table.id}`, provenance: review ? "Human reviewed" : "Ninox evidence" });
    for (const field of table.fields) {
      const fieldReview = data.catalog.annotations.fields[`${table.id}:${field.id}`];
      const fieldText = [field.name, field.id, field.type, fieldReview?.description, fieldReview?.safeUse, fieldReview?.notes].filter(Boolean).join(" ").toLowerCase();
      if (fieldText.includes(normalized)) results.push({ kind: "field", tableId: table.id, fieldId: field.id, label: `${table.name}.${field.name}`, detail: fieldReview?.description || `${field.id} · ${field.type}`, provenance: fieldReview ? "Human reviewed" : "Ninox evidence" });
    }
  }
  for (const consumer of Object.values(data.catalog.annotations.consumers)) {
    const text = [consumer.name, consumer.id, consumer.kind, consumer.purpose, ...consumer.filters, ...consumer.joins, ...consumer.freshnessLimitations].join(" ").toLowerCase();
    if (!text.includes(normalized)) continue;
    for (const tableId of consumer.tableIds) results.push({ kind: "consumer", tableId, fieldId: null, label: consumer.name, detail: consumer.purpose || consumer.kind, provenance: "Human reviewed" });
  }
  for (const table of data.declared?.tables ?? []) {
    const tableText = [table.report, table.ninoxName, table.tableId, table.grain].filter(Boolean).join(" ").toLowerCase();
    if (tableText.includes(normalized)) {
      results.push({ kind: "declared", tableId: table.tableId ?? "", fieldId: null, label: `${table.ninoxName} (${table.report})`, detail: table.tableId ? `Declared reporting table ${table.tableId}` : "Ninox table ID Unknown", provenance: "External candidate" });
    }
    for (const field of table.fields) {
      const fieldText = [field.reportField, field.tableId, field.fieldId].join(" ").toLowerCase();
      if (fieldText.includes(normalized)) results.push({ kind: "declared", tableId: field.tableId, fieldId: field.fieldId, label: `${table.ninoxName}.${field.reportField}`, detail: `${field.tableId}.${field.fieldId} · ${field.binding}`, provenance: "External candidate" });
    }
  }
  return results.slice(0, limit);
}

export interface ExplorerHistory {
  baseline: boolean;
  fromScannedAt: string | null;
  toScannedAt: string;
  summary: StructuralChangeSummary;
  highlights: string[];
  remainingChanges: number;
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Unknown";
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function normalizeExplorerFields(rawFields: unknown): ExplorerField[] {
  if (!Array.isArray(rawFields)) return [];
  return rawFields.flatMap((raw) => {
    const field = object(raw);
    if (!field) return [];
    const type = text(field.type);
    const choices = Array.isArray(field.choices)
      ? field.choices.flatMap((rawChoice) => {
        const choice = object(rawChoice);
        return choice ? [{ id: text(choice.id), caption: text(choice.caption) }] : [];
      })
      : [];
    const referenceToTable = text(field.referenceToTable);
    const referenceFromTable = text(field.referenceFromTable);
    const referenceFromField = text(field.referenceFromField);
    const referenceDataMissing = type === "ref"
      ? referenceToTable === "Unknown"
      : type === "rev" && (referenceFromTable === "Unknown" || referenceFromField === "Unknown");
    return [{
      id: text(field.id),
      name: text(field.name),
      type,
      choices,
      referenceToTable,
      referenceFromTable,
      referenceFromField,
      reverseField: text(field.reverseField),
      metadataState: type === "Unknown" ? "unknown" : referenceDataMissing ? "partial" : "available",
    } satisfies ExplorerField];
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function summarizeStructuralDiff(diff: StructuralDiff | null): ExplorerHistory | null {
  if (!diff) return null;
  const highlights = [
    ...diff.tables.added.map((table) => `Table added: ${table.name} (${table.id})`),
    ...diff.tables.removed.map((table) => `Table removed: ${table.name} (${table.id})`),
    ...diff.tables.renamed.map((table) => `Table renamed: ${table.previousName} → ${table.name} (${table.id})`),
    ...diff.fields.added.map((field) => `Field added: ${field.tableName}.${field.name} (${field.id})`),
    ...diff.fields.removed.map((field) => `Field removed: ${field.tableName}.${field.name} (${field.id})`),
    ...diff.fields.renamed.map((field) => `Field renamed: ${field.tableName}.${field.previousName} → ${field.name} (${field.id})`),
    ...diff.fields.changed.map((field) => `Field changed: ${field.tableName}.${field.name} — ${field.changedProperties.join(", ")}`),
    ...diff.relationships.added.map((relationship) => `Relationship added: ${relationship.sourceTableId}.${relationship.sourceFieldId} → ${relationship.targetTableId}`),
    ...diff.relationships.removed.map((relationship) => `Relationship removed: ${relationship.sourceTableId}.${relationship.sourceFieldId} → ${relationship.targetTableId}`),
    ...diff.relationships.changed.map((relationship) => `Relationship changed: ${relationship.sourceTableId}.${relationship.sourceFieldId} → ${relationship.targetTableId} — ${relationship.changedProperties.join(", ")}`),
  ];
  const visibleHighlights = highlights.slice(0, 8);
  return {
    baseline: diff.baseline,
    fromScannedAt: diff.fromScannedAt,
    toScannedAt: diff.toScannedAt,
    summary: diff.summary,
    highlights: visibleHighlights,
    remainingChanges: Math.max(0, highlights.length - visibleHighlights.length),
  };
}

export function relationshipCounts(relationships: ExplorerRelationship[]) {
  const counts = new Map<string, number>();
  for (const relationship of relationships) {
    counts.set(relationship.sourceTableId, (counts.get(relationship.sourceTableId) ?? 0) + 1);
    counts.set(relationship.targetTableId, (counts.get(relationship.targetTableId) ?? 0) + 1);
  }
  return counts;
}

export function filterRelationships(relationships: ExplorerRelationship[], source: RelationshipSource | "all", direction: Direction, tableId?: string) {
  return relationships.filter((relationship) => {
    const matchesSource = source === "all" || relationship.source === source;
    const matchesDirection = !tableId
      || (direction === "all" && (relationship.sourceTableId === tableId || relationship.targetTableId === tableId))
      || (direction === "outgoing" && relationship.sourceTableId === tableId)
      || (direction === "incoming" && relationship.targetTableId === tableId);
    return matchesSource && matchesDirection;
  });
}

type RelationshipIdentity = { sourceTableId: string; sourceFieldId: string; targetTableId: string };

function relationshipKey(relationship: RelationshipIdentity) {
  return `${relationship.sourceTableId}\u0000${relationship.sourceFieldId}\u0000${relationship.targetTableId}`;
}

export function scopedRelationships<T extends RelationshipIdentity>(scope: ExplorerScope, relationships: T[], shopEdges: RelationshipIdentity[], reportingIds: Iterable<string> = []) {
  if (scope === "all") return relationships;
  if (scope === "shop") {
    const shopKeys = new Set(shopEdges.map(relationshipKey));
    return relationships.filter((relationship) => shopKeys.has(relationshipKey(relationship)));
  }
  const ids = new Set(reportingIds);
  return relationships.filter((relationship) => ids.has(relationship.sourceTableId) || ids.has(relationship.targetTableId));
}

export function preserveExplorerScope(scope: ExplorerScope, tableId: string, scopeIds: Set<string>): ExplorerScope {
  return scope !== "all" && scopeIds.has(tableId) ? scope : "all";
}

export function preserveShopScope(scope: "shop" | "all", tableId: string, shopIds: Set<string>): "shop" | "all" {
  return preserveExplorerScope(scope, tableId, shopIds) === "shop" ? "shop" : "all";
}

export function tableIdForShopScope(selectedTable: string, shopIds: Set<string>, anchorId: string): string {
  return shopIds.has(selectedTable) ? selectedTable : anchorId;
}
