import {
  fieldReviewKey,
  humanProvenance,
  relationshipReviewKey,
  type CatalogAnnotations,
  type ConsumerUsage,
  type FieldReview,
  type ImportCandidate,
  type RelationshipReview,
  type TableReview,
} from "./types.js";

export function defaultTableReview(tableId: string, now = new Date().toISOString()): TableReview {
  return { tableId, description: "", status: "unknown", grain: "", businessKeyFieldIds: [], criticality: "unknown", tags: [], useFor: [], doNotUseFor: [], notes: "", provenance: humanProvenance(), updatedAt: now };
}

export function defaultFieldReview(tableId: string, fieldId: string, now = new Date().toISOString()): FieldReview {
  return { tableId, fieldId, description: "", role: "unknown", sensitive: false, criticality: "unknown", safeUse: "", notes: "", provenance: humanProvenance(), updatedAt: now };
}

export function defaultRelationshipReview(sourceTableId: string, sourceFieldId: string, targetTableId: string, now = new Date().toISOString()): RelationshipReview {
  return { sourceTableId, sourceFieldId, targetTableId, decision: "pending", cardinality: "unknown", joinRule: "", notes: "", provenance: humanProvenance(), updatedAt: now };
}

function fillBlank<T extends object>(current: T, proposed: Partial<T>): T {
  const result = { ...current };
  for (const [rawKey, next] of Object.entries(proposed)) {
    const key = rawKey as keyof T;
    const existing = result[key];
    const blank = existing === "" || existing === "unknown" || existing == null || (Array.isArray(existing) && existing.length === 0);
    if (blank && next !== undefined) result[key] = next as T[keyof T];
  }
  return result;
}

export function decideCandidate(
  catalog: CatalogAnnotations,
  candidateId: string,
  decision: "accepted" | "rejected",
  overrideDescription = "",
  now = new Date().toISOString(),
): CatalogAnnotations {
  const candidate = catalog.candidates[candidateId];
  if (!candidate) throw new Error("Import candidate was not found");
  candidate.decision = decision;
  candidate.decidedAt = now;
  if (decision === "rejected") return catalog;

  if (candidate.kind === "table" && candidate.payload.table) {
    const existing = catalog.tables[candidate.tableId];
    const base = existing ?? { ...defaultTableReview(candidate.tableId, now), provenance: candidate.provenance };
    const proposed = { ...candidate.payload.table };
    if (overrideDescription.trim()) proposed.description = overrideDescription.trim();
    catalog.tables[candidate.tableId] = { ...fillBlank(base, proposed), updatedAt: now };
  }
  if (candidate.kind === "field" && candidate.fieldId && candidate.payload.field) {
    const key = fieldReviewKey(candidate.tableId, candidate.fieldId);
    const existing = catalog.fields[key];
    const base = existing ?? { ...defaultFieldReview(candidate.tableId, candidate.fieldId, now), provenance: candidate.provenance };
    const proposed = { ...candidate.payload.field };
    if (overrideDescription.trim()) proposed.description = overrideDescription.trim();
    catalog.fields[key] = { ...fillBlank(base, proposed), updatedAt: now };
  }
  if (candidate.kind === "consumer" && candidate.payload.consumer?.id) {
    const proposed = candidate.payload.consumer;
    const id = proposed.id!;
    const existing = catalog.consumers[id];
    const base: ConsumerUsage = existing ?? {
      id, name: id, kind: "report", purpose: "", tableIds: [], fieldKeys: [], filters: [], joins: [], freshnessLimitations: [], provenance: candidate.provenance, updatedAt: now,
    };
    const merged = fillBlank<ConsumerUsage>(base, proposed as Partial<ConsumerUsage>);
    if (overrideDescription.trim()) merged.purpose = overrideDescription.trim();
    catalog.consumers[id] = { ...merged, updatedAt: now };
  }
  return catalog;
}

export function upsertTableReview(catalog: CatalogAnnotations, review: TableReview): CatalogAnnotations {
  catalog.tables[review.tableId] = { ...review, provenance: humanProvenance(), updatedAt: new Date().toISOString() };
  return catalog;
}

export function upsertFieldReview(catalog: CatalogAnnotations, review: FieldReview): CatalogAnnotations {
  catalog.fields[fieldReviewKey(review.tableId, review.fieldId)] = { ...review, provenance: humanProvenance(), updatedAt: new Date().toISOString() };
  return catalog;
}

export function upsertRelationshipReview(catalog: CatalogAnnotations, review: RelationshipReview): CatalogAnnotations {
  catalog.relationships[relationshipReviewKey(review.sourceTableId, review.sourceFieldId, review.targetTableId)] = { ...review, provenance: humanProvenance(), updatedAt: new Date().toISOString() };
  return catalog;
}

export function upsertConsumer(catalog: CatalogAnnotations, consumer: ConsumerUsage): CatalogAnnotations {
  catalog.consumers[consumer.id] = { ...consumer, provenance: humanProvenance(), updatedAt: new Date().toISOString() };
  return catalog;
}

export function candidatePrimaryText(candidate: ImportCandidate): string {
  return candidate.payload.table?.description ?? candidate.payload.field?.description ?? candidate.payload.consumer?.purpose ?? "";
}
