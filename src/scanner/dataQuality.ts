import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Relationship } from "./relationshipAnalyzer.js";

export interface QualityTable {
  tableId: string;
  tableName: string;
}

export interface UnresolvedReference {
  sourceTable: string;
  sourceTableId: string;
  sourceField: string;
  sourceFieldId: string;
  targetTableId: string;
  reason: "missing-target-id" | "target-not-in-schema";
}

export interface DataQualityReport {
  generatedAt: string;
  scanScannedAt: string;
  tables: {
    total: number;
    connected: number;
    isolated: number;
    hypothesisOnly: number;
  };
  relationships: {
    confirmed: number;
    detected: number;
    unknown: number;
  };
  isolatedTables: QualityTable[];
  hypothesisOnlyTables: QualityTable[];
  inferredRelationships: Relationship[];
  unresolvedReferences: UnresolvedReference[];
  scanErrors: { tableId: string; message: string }[];
}

export interface DataQualityEvidence {
  scannedAt: string;
  tables: { id?: unknown; name?: unknown }[];
  relationships: Relationship[];
  errors: { tableId: string; message: string }[];
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Unknown";
}

export function buildDataQualityReport(evidence: DataQualityEvidence): DataQualityReport {
  const tables = evidence.tables.map((table) => ({ tableId: text(table.id), tableName: text(table.name) }));
  const tableIds = new Set(tables.map((table) => table.tableId));
  const connectedIds = new Set<string>();
  const confirmedIds = new Set<string>();
  const detectedIds = new Set<string>();

  for (const relationship of evidence.relationships) {
    if (!tableIds.has(relationship.sourceTableId) || !tableIds.has(relationship.targetTableId)) continue;
    connectedIds.add(relationship.sourceTableId);
    connectedIds.add(relationship.targetTableId);
    if (relationship.source === "ninox") {
      confirmedIds.add(relationship.sourceTableId);
      confirmedIds.add(relationship.targetTableId);
    }
    if (relationship.source === "detected") {
      detectedIds.add(relationship.sourceTableId);
      detectedIds.add(relationship.targetTableId);
    }
  }

  const isolatedTables = tables.filter((table) => !connectedIds.has(table.tableId));
  const hypothesisOnlyTables = tables.filter((table) => detectedIds.has(table.tableId) && !confirmedIds.has(table.tableId));
  const unresolvedReferences = evidence.relationships
    .filter((relationship) => relationship.source !== "detected" && !tableIds.has(relationship.targetTableId))
    .map((relationship) => ({
      sourceTable: relationship.sourceTable,
      sourceTableId: relationship.sourceTableId,
      sourceField: relationship.sourceField,
      sourceFieldId: relationship.sourceFieldId,
      targetTableId: relationship.targetTableId,
      reason: relationship.targetTableId === "Unknown" ? "missing-target-id" as const : "target-not-in-schema" as const,
    }));
  const inferredRelationships = evidence.relationships.filter((relationship) => relationship.source === "detected");

  return {
    generatedAt: evidence.scannedAt,
    scanScannedAt: evidence.scannedAt,
    tables: {
      total: tables.length,
      connected: connectedIds.size,
      isolated: isolatedTables.length,
      hypothesisOnly: hypothesisOnlyTables.length,
    },
    relationships: {
      confirmed: evidence.relationships.filter((relationship) => relationship.source === "ninox").length,
      detected: inferredRelationships.length,
      unknown: evidence.relationships.filter((relationship) => relationship.source === "unknown").length,
    },
    isolatedTables,
    hypothesisOnlyTables,
    inferredRelationships,
    unresolvedReferences,
    scanErrors: evidence.errors,
  };
}

export async function writeDataQualityReport(report: DataQualityReport, outputRoot = resolve(process.cwd(), "output")): Promise<string> {
  const analysisRoot = resolve(outputRoot, "analysis");
  await mkdir(analysisRoot, { recursive: true });
  const outputPath = resolve(analysisRoot, "data-quality.json");
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return outputPath;
}

export async function generateDataQualityReport(outputRoot = resolve(process.cwd(), "output")): Promise<DataQualityReport> {
  const [schema, relationshipArtifact, summary] = await Promise.all([
    readFile(resolve(outputRoot, "schema.json"), "utf8"),
    readFile(resolve(outputRoot, "relationships.json"), "utf8"),
    readFile(resolve(outputRoot, "scan-summary.json"), "utf8"),
  ]);
  const schemaData = JSON.parse(schema) as { scannedAt: string; tables: { id?: unknown; name?: unknown }[] };
  const relationshipData = JSON.parse(relationshipArtifact) as { relationships: Relationship[] };
  const summaryData = JSON.parse(summary) as { errors?: { tableId: string; message: string }[] };
  return buildDataQualityReport({
    scannedAt: schemaData.scannedAt,
    tables: schemaData.tables,
    relationships: relationshipData.relationships,
    errors: summaryData.errors ?? [],
  });
}
