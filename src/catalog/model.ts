import type { NinoxTableSchema } from "../ninox/types.js";
import {
  fieldReviewKey,
  relationshipReviewKey,
  type CatalogAnnotations,
  type CatalogCoverage,
  type CatalogOrphan,
} from "./types.js";

export interface RelationshipIdentity {
  sourceTableId: string;
  sourceFieldId: string;
  targetTableId: string;
}

export function catalogCoverage(catalog: CatalogAnnotations, orphans: CatalogOrphan[]): CatalogCoverage {
  return {
    reviewedTables: Object.keys(catalog.tables).length,
    documentedFields: Object.keys(catalog.fields).length,
    pendingCandidates: Object.values(catalog.candidates).filter((candidate) => candidate.decision === "pending").length,
    pendingRelationships: Object.values(catalog.relationships).filter((review) => review.decision === "pending").length,
    orphanedAnnotations: orphans.length,
  };
}

export function findCatalogOrphans(
  catalog: CatalogAnnotations,
  tables: NinoxTableSchema[],
  relationships: RelationshipIdentity[],
): CatalogOrphan[] {
  const tableIds = new Set(tables.flatMap((table) => typeof table.id === "string" ? [table.id] : []));
  const fieldKeys = new Set(tables.flatMap((table) => {
    if (typeof table.id !== "string" || !Array.isArray(table.fields)) return [];
    return table.fields.flatMap((field) => {
      if (!field || typeof field !== "object" || !("id" in field) || typeof field.id !== "string") return [];
      return [fieldReviewKey(table.id as string, field.id)];
    });
  }));
  const relationshipKeys = new Set(relationships.map((relationship) => relationshipReviewKey(
    relationship.sourceTableId,
    relationship.sourceFieldId,
    relationship.targetTableId,
  )));
  const orphans: CatalogOrphan[] = [];

  for (const tableId of Object.keys(catalog.tables)) {
    if (!tableIds.has(tableId)) orphans.push({ kind: "table", key: tableId, reason: "Table ID is absent from the current Ninox schema" });
  }
  for (const key of Object.keys(catalog.fields)) {
    if (!fieldKeys.has(key)) orphans.push({ kind: "field", key, reason: "Table/field ID pair is absent from the current Ninox schema" });
  }
  for (const key of Object.keys(catalog.relationships)) {
    if (!relationshipKeys.has(key)) orphans.push({ kind: "relationship", key, reason: "Relationship identity is absent from the current scan" });
  }
  for (const [id, consumer] of Object.entries(catalog.consumers)) {
    if (consumer.tableIds.some((tableId) => !tableIds.has(tableId))) {
      orphans.push({ kind: "consumer", key: id, reason: "Consumer references a table absent from the current Ninox schema" });
    }
  }
  return orphans;
}
