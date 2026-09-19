import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { catalogCoverage, findCatalogOrphans } from "../src/catalog/model.js";
import { readCatalog } from "../src/catalog/store.js";
import { buildDataQualityReport, emptyDataQualityReport, type DataQualityReport } from "../src/scanner/dataQuality.js";
import { readStructuralDiffHistory } from "../src/scanner/scanHistory.js";
import { shopMapFromRelationships } from "../src/scanner/shopMap.js";
import type { NinoxTableSchema } from "../src/ninox/types.js";
import type { ShopMapData } from "./types.js";
import {
  normalizeExplorerFields,
  relationshipCounts,
  summarizeStructuralDiff,
  type ExplorerData,
  type ExplorerRelationship,
} from "./explorer-data.js";

async function readOptionalJson<T>(absolutePath: string, label: string): Promise<{ value: T | null; issue: string | null }> {
  try {
    return { value: JSON.parse(await readFile(absolutePath, "utf8")) as T, issue: null };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { value: null, issue: `${label} is missing` };
    return { value: null, issue: `${label} could not be read` };
  }
}

function text(value: unknown, fallback = "Unknown"): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeRelationships(rawRelationships: unknown): ExplorerRelationship[] {
  if (!Array.isArray(rawRelationships)) return [];
  return rawRelationships.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const relationship = raw as Partial<ExplorerRelationship> & { metadata?: { reverseValidated?: boolean } };
    const source = relationship.source === "ninox" || relationship.source === "detected" || relationship.source === "unknown" ? relationship.source : "unknown";
    const provenance = source === "ninox"
      ? relationship.metadata?.reverseValidated ? "Ninox ref + rev" : "Ninox ref"
      : source === "detected" ? "sample overlap"
      : "unresolved Ninox ref";
    return [{
      sourceTable: text(relationship.sourceTable),
      sourceTableId: text(relationship.sourceTableId),
      sourceField: text(relationship.sourceField),
      sourceFieldId: text(relationship.sourceFieldId),
      targetTable: text(relationship.targetTable),
      targetTableId: text(relationship.targetTableId),
      targetField: text(relationship.targetField, "id"),
      reverseField: text(relationship.reverseField),
      source,
      confidence: typeof relationship.confidence === "number" ? relationship.confidence : source === "ninox" ? 1 : 0,
      provenance,
      raw: raw as Record<string, unknown>,
    } satisfies ExplorerRelationship];
  });
}

function normalizeShopMap(raw: unknown, relationships: ExplorerRelationship[], tables: { id?: unknown; name?: unknown }[]): ShopMapData {
  const item = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Partial<ShopMapData> : null;
  if (!item) {
    const synthesized = shopMapFromRelationships(relationships, tables, "Unknown");
    return { ...synthesized, allTables: tables.map((table) => ({ tableId: text(table.id), tableName: text(table.name), relationshipCount: 0 })) };
  }
  const anchor = item.anchor && typeof item.anchor === "object"
    ? { tableId: text(item.anchor.tableId, "E"), tableName: text(item.anchor.tableName, "TrucksDB") }
    : { tableId: "E", tableName: "TrucksDB" };
  return {
    generatedAt: text(item.generatedAt),
    anchor,
    nodes: Array.isArray(item.nodes) ? item.nodes : [],
    edges: Array.isArray(item.edges) ? item.edges : [],
    hypotheses: Array.isArray(item.hypotheses) ? item.hypotheses : [],
    allTables: Array.isArray(item.allTables) ? item.allTables : undefined,
  };
}

function normalizeQuality(raw: unknown, scannedAt: string, tables: { id?: unknown; name?: unknown }[], relationships: ExplorerRelationship[], errors: { tableId: string; message: string }[]): DataQualityReport {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "tables" in raw && "relationships" in raw) {
    return raw as DataQualityReport;
  }
  if (tables.length === 0 && relationships.length === 0) return emptyDataQualityReport(scannedAt);
  return buildDataQualityReport({ scannedAt, tables, relationships, errors });
}

export async function loadExplorerData(root = process.cwd()): Promise<ExplorerData> {
  const outputRoot = resolve(root, "output");
  const [schemaFile, relationshipFile, summaryFile, shopMapFile, qualityFile, history, catalogState] = await Promise.all([
    readOptionalJson<{ scannedAt?: unknown; tableCount?: unknown; fieldCount?: unknown; tables?: NinoxTableSchema[] }>(resolve(outputRoot, "schema.json"), "output/schema.json"),
    readOptionalJson<{ relationships?: unknown }>(resolve(outputRoot, "relationships.json"), "output/relationships.json"),
    readOptionalJson<{ tableCount?: unknown; fieldCount?: unknown; sampledRecords?: unknown; errors?: { tableId: string; message: string }[] }>(resolve(outputRoot, "scan-summary.json"), "output/scan-summary.json"),
    readOptionalJson<unknown>(resolve(outputRoot, "analysis", "shop-map.json"), "output/analysis/shop-map.json"),
    readOptionalJson<unknown>(resolve(outputRoot, "analysis", "data-quality.json"), "output/analysis/data-quality.json"),
    readStructuralDiffHistory(outputRoot),
    readCatalog(resolve(outputRoot, "review")),
  ]);

  const schemaTables = Array.isArray(schemaFile.value?.tables) ? schemaFile.value.tables : [];
  const relationships = normalizeRelationships(relationshipFile.value?.relationships);
  const counts = relationshipCounts(relationships);
  const tables = schemaTables.map((table) => {
    const id = typeof table.id === "string" ? table.id : "Unknown";
    return { id, name: typeof table.name === "string" ? table.name : "Unknown", fields: normalizeExplorerFields(table.fields), relationshipCount: counts.get(id) ?? 0 };
  });
  const scannedAt = text(schemaFile.value?.scannedAt);
  const summary = {
    tableCount: typeof schemaFile.value?.tableCount === "number" ? schemaFile.value.tableCount : tables.length,
    relationshipCount: relationships.length,
    fieldCount: typeof schemaFile.value?.fieldCount === "number" ? schemaFile.value.fieldCount : tables.reduce((count, table) => count + table.fields.length, 0),
    sampledRecords: typeof summaryFile.value?.sampledRecords === "number" ? summaryFile.value.sampledRecords : 0,
  };
  const orphans = findCatalogOrphans(catalogState.catalog, schemaTables, relationships);
  const blockingIssues = [schemaFile.issue, relationshipFile.issue].filter((issue): issue is string => Boolean(issue));
  const loadIssue = blockingIssues.length
    ? `Local scan artifacts need attention: ${blockingIssues.join("; ")}. Run npm run scan or Rescan after configuring .env.local.`
    : null;

  return {
    generatedAt: scannedAt,
    tables,
    relationships,
    shopMap: normalizeShopMap(shopMapFile.value, relationships, schemaTables),
    summary,
    quality: normalizeQuality(qualityFile.value, scannedAt, schemaTables, relationships, summaryFile.value?.errors ?? []),
    history: history.map((diff) => summarizeStructuralDiff(diff)).filter((item): item is NonNullable<typeof item> => item !== null),
    catalog: { annotations: catalogState.catalog, coverage: catalogCoverage(catalogState.catalog, orphans), orphans, issue: catalogState.issue },
    loadIssue,
  };
}
