export const CATALOG_SCHEMA_VERSION = 1 as const;

export type ReviewStatus = "active" | "obsolete" | "temporary" | "duplicate" | "merge-candidate" | "unknown";
export type Criticality = "low" | "medium" | "high" | "unknown";
export type FieldRole = "business-key" | "dimension" | "measure" | "status" | "date" | "reference" | "sensitive" | "unknown";
export type RelationshipDecision = "confirmed" | "rejected" | "pending";
export type RelationshipCardinality = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many" | "unknown";
export type ConsumerKind = "app" | "report" | "api" | "job";
export type CandidateDecision = "pending" | "accepted" | "rejected";
export type CandidateKind = "table" | "field" | "consumer";

export interface KnowledgeProvenance {
  kind: "human" | "external";
  sourceId: string;
  sourceLabel: string;
  sourceVersion: string | null;
  verifiedAt: string | null;
  importedAt: string | null;
  contentHash: string | null;
}

export interface TableReview {
  tableId: string;
  description: string;
  status: ReviewStatus;
  grain: string;
  businessKeyFieldIds: string[];
  criticality: Criticality;
  tags: string[];
  useFor: string[];
  doNotUseFor: string[];
  notes: string;
  provenance: KnowledgeProvenance;
  updatedAt: string;
}

export interface FieldReview {
  tableId: string;
  fieldId: string;
  description: string;
  role: FieldRole;
  sensitive: boolean;
  criticality: Criticality;
  safeUse: string;
  notes: string;
  provenance: KnowledgeProvenance;
  updatedAt: string;
}

export interface RelationshipReview {
  sourceTableId: string;
  sourceFieldId: string;
  targetTableId: string;
  decision: RelationshipDecision;
  cardinality: RelationshipCardinality;
  joinRule: string;
  notes: string;
  provenance: KnowledgeProvenance;
  updatedAt: string;
}

export interface ConsumerUsage {
  id: string;
  name: string;
  kind: ConsumerKind;
  purpose: string;
  tableIds: string[];
  fieldKeys: string[];
  filters: string[];
  joins: string[];
  freshnessLimitations: string[];
  provenance: KnowledgeProvenance;
  updatedAt: string;
}

export interface ImportCandidatePayload {
  table?: Partial<Omit<TableReview, "tableId" | "provenance" | "updatedAt">>;
  field?: Partial<Omit<FieldReview, "tableId" | "fieldId" | "provenance" | "updatedAt">>;
  consumer?: Partial<Omit<ConsumerUsage, "provenance" | "updatedAt">>;
}

export interface ImportCandidate {
  id: string;
  kind: CandidateKind;
  tableId: string;
  fieldId: string | null;
  decision: CandidateDecision;
  payload: ImportCandidatePayload;
  provenance: KnowledgeProvenance;
  createdAt: string;
  decidedAt: string | null;
}

export interface CatalogAnnotations {
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  updatedAt: string;
  tables: Record<string, TableReview>;
  fields: Record<string, FieldReview>;
  relationships: Record<string, RelationshipReview>;
  consumers: Record<string, ConsumerUsage>;
  candidates: Record<string, ImportCandidate>;
}

export interface CatalogLoadResult {
  catalog: CatalogAnnotations;
  issue: string | null;
}

export interface CatalogOrphan {
  kind: "table" | "field" | "relationship" | "consumer";
  key: string;
  reason: string;
}

export interface CatalogCoverage {
  reviewedTables: number;
  documentedFields: number;
  pendingCandidates: number;
  pendingRelationships: number;
  orphanedAnnotations: number;
}

export function fieldReviewKey(tableId: string, fieldId: string): string {
  return `${tableId}:${fieldId}`;
}

export function relationshipReviewKey(sourceTableId: string, sourceFieldId: string, targetTableId: string): string {
  return `${sourceTableId}:${sourceFieldId}:${targetTableId}`;
}

export function humanProvenance(): KnowledgeProvenance {
  return {
    kind: "human",
    sourceId: "local-review",
    sourceLabel: "Human review",
    sourceVersion: null,
    verifiedAt: null,
    importedAt: null,
    contentHash: null,
  };
}
