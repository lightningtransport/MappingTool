"use server";

import { revalidatePath } from "next/cache";
import { writeCatalogExports } from "../src/catalog/exportCatalog.js";
import { decideCandidate, defaultFieldReview, defaultRelationshipReview, defaultTableReview, upsertConsumer, upsertFieldReview, upsertRelationshipReview, upsertTableReview } from "../src/catalog/review.js";
import { mutateCatalog, readCatalog } from "../src/catalog/store.js";
import { humanProvenance, type ConsumerKind, type Criticality, type FieldRole, type RelationshipCardinality, type RelationshipDecision, type ReviewStatus } from "../src/catalog/types.js";

export interface CatalogActionState { status: "idle" | "success" | "error"; message: string }

function value(form: FormData, name: string, max = 4000): string {
  const raw = form.get(name);
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function list(form: FormData, name: string): string[] {
  return value(form, name, 12000).split(/[\n,]/).map((item) => item.trim()).filter(Boolean).slice(0, 200);
}

function oneOf<T extends string>(input: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(input as T) ? input as T : fallback;
}

async function action(run: () => Promise<void>, success: string): Promise<CatalogActionState> {
  try {
    await run();
    revalidatePath("/");
    return { status: "success", message: success };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Catalog update failed" };
  }
}

export async function saveTableReviewAction(_state: CatalogActionState, form: FormData): Promise<CatalogActionState> {
  const tableId = value(form, "tableId", 100);
  if (!tableId) return { status: "error", message: "Table ID is required" };
  return action(async () => {
    await mutateCatalog((catalog) => upsertTableReview(catalog, {
      ...defaultTableReview(tableId),
      description: value(form, "description"),
      status: oneOf<ReviewStatus>(value(form, "status"), ["active", "obsolete", "temporary", "duplicate", "merge-candidate", "unknown"], "unknown"),
      grain: value(form, "grain"),
      businessKeyFieldIds: list(form, "businessKeyFieldIds"),
      criticality: oneOf<Criticality>(value(form, "criticality"), ["low", "medium", "high", "unknown"], "unknown"),
      tags: list(form, "tags"), useFor: list(form, "useFor"), doNotUseFor: list(form, "doNotUseFor"), notes: value(form, "notes"),
    }));
  }, `Saved review for table ${tableId}`);
}

export async function saveFieldReviewAction(_state: CatalogActionState, form: FormData): Promise<CatalogActionState> {
  const tableId = value(form, "tableId", 100);
  const fieldId = value(form, "fieldId", 100);
  if (!tableId || !fieldId) return { status: "error", message: "Table and field IDs are required" };
  return action(async () => {
    await mutateCatalog((catalog) => upsertFieldReview(catalog, {
      ...defaultFieldReview(tableId, fieldId),
      description: value(form, "description"),
      role: oneOf<FieldRole>(value(form, "role"), ["business-key", "dimension", "measure", "status", "date", "reference", "sensitive", "unknown"], "unknown"),
      sensitive: form.get("sensitive") === "on",
      criticality: oneOf<Criticality>(value(form, "criticality"), ["low", "medium", "high", "unknown"], "unknown"),
      safeUse: value(form, "safeUse"), notes: value(form, "notes"),
    }));
  }, `Saved review for ${tableId}.${fieldId}`);
}

export async function saveRelationshipReviewAction(_state: CatalogActionState, form: FormData): Promise<CatalogActionState> {
  const sourceTableId = value(form, "sourceTableId", 100);
  const sourceFieldId = value(form, "sourceFieldId", 100);
  const targetTableId = value(form, "targetTableId", 100);
  if (!sourceTableId || !sourceFieldId || !targetTableId) return { status: "error", message: "Relationship identity is required" };
  return action(async () => {
    await mutateCatalog((catalog) => upsertRelationshipReview(catalog, {
      ...defaultRelationshipReview(sourceTableId, sourceFieldId, targetTableId),
      decision: oneOf<RelationshipDecision>(value(form, "decision"), ["confirmed", "rejected", "pending"], "pending"),
      cardinality: oneOf<RelationshipCardinality>(value(form, "cardinality"), ["one-to-one", "one-to-many", "many-to-one", "many-to-many", "unknown"], "unknown"),
      joinRule: value(form, "joinRule"), notes: value(form, "notes"),
    }));
  }, "Saved relationship review");
}

export async function saveConsumerAction(_state: CatalogActionState, form: FormData): Promise<CatalogActionState> {
  const id = value(form, "id", 160).replace(/[^a-zA-Z0-9:_-]+/g, "-");
  const name = value(form, "name", 240);
  if (!id || !name) return { status: "error", message: "Consumer ID and name are required" };
  return action(async () => {
    await mutateCatalog((catalog) => upsertConsumer(catalog, {
      id, name,
      kind: oneOf<ConsumerKind>(value(form, "kind"), ["app", "report", "api", "job"], "report"),
      purpose: value(form, "purpose"), tableIds: list(form, "tableIds"), fieldKeys: list(form, "fieldKeys"), filters: list(form, "filters"), joins: list(form, "joins"), freshnessLimitations: list(form, "freshnessLimitations"),
      provenance: humanProvenance(), updatedAt: new Date().toISOString(),
    }));
  }, `Saved consumer ${name}`);
}

export async function reviewCandidateAction(_state: CatalogActionState, form: FormData): Promise<CatalogActionState> {
  const candidateId = value(form, "candidateId", 300);
  const decision = value(form, "decision") === "rejected" ? "rejected" : "accepted";
  if (!candidateId) return { status: "error", message: "Candidate ID is required" };
  return action(async () => {
    await mutateCatalog((catalog) => decideCandidate(catalog, candidateId, decision, value(form, "overrideDescription")));
  }, decision === "accepted" ? "Candidate accepted" : "Candidate rejected");
}

export async function exportCatalogAction(_state: CatalogActionState, _form: FormData): Promise<CatalogActionState> {
  return action(async () => {
    const loaded = await readCatalog();
    if (loaded.issue) throw new Error(loaded.issue);
    await writeCatalogExports(loaded.catalog);
  }, "Generated safe JSON and Markdown exports in output/review/exports");
}
