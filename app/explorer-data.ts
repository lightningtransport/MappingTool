import type { ShopMapData } from "./types.js";
import type { DataQualityReport } from "../src/scanner/dataQuality.js";

export type RelationshipSource = "ninox" | "detected" | "unknown";
export type Direction = "all" | "incoming" | "outgoing";

export interface ExplorerTable {
  id: string;
  name: string;
  relationshipCount: number;
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
