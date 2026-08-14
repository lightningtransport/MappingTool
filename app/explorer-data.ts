import type { ShopMapData } from "./types.js";
import type { DataQualityReport } from "../src/scanner/dataQuality.js";
import type { StructuralChangeSummary, StructuralDiff } from "../src/scanner/scanHistory.js";

export type RelationshipSource = "ninox" | "detected" | "unknown";
export type Direction = "all" | "incoming" | "outgoing";
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

export function scopedRelationships<T extends RelationshipIdentity>(scope: "shop" | "all", relationships: T[], shopEdges: RelationshipIdentity[]) {
  if (scope === "all") return relationships;
  const shopKeys = new Set(shopEdges.map(relationshipKey));
  return relationships.filter((relationship) => shopKeys.has(relationshipKey(relationship)));
}
