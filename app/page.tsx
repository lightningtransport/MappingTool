import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import RelationshipExplorer from "./relationship-explorer.js";
import { relationshipCounts, type ExplorerData, type ExplorerRelationship } from "./explorer-data.js";
import type { ShopMapData } from "./types.js";
import type { DataQualityReport } from "../src/scanner/dataQuality.js";

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(resolve(process.cwd(), relativePath), "utf8")) as T;
}

export async function loadExplorerData(): Promise<ExplorerData> {
  const [schema, relationshipArtifact, summary, shopMap, quality] = await Promise.all([
    readJson<{ scannedAt: string; tableCount: number; fieldCount: number; tables: { id: string; name: string }[] }>("output/schema.json"),
    readJson<{ scannedAt: string; relationships: Record<string, unknown>[] }>("output/relationships.json"),
    readJson<{ tableCount: number; fieldCount: number; sampledRecords: number; relationships: { ninox?: number; detected?: number; unknown?: number } }>("output/scan-summary.json"),
    readJson<ShopMapData>("output/analysis/shop-map.json"),
    readJson<DataQualityReport>("output/analysis/data-quality.json"),
  ]);
  const relationships = relationshipArtifact.relationships.map((raw) => {
    const relationship = raw as Partial<ExplorerRelationship>;
    const source = relationship.source === "ninox" || relationship.source === "detected" || relationship.source === "unknown" ? relationship.source : "unknown";
    return { ...relationship, source, provenance: source, raw } as ExplorerRelationship;
  });
  const counts = relationshipCounts(relationships);
  return {
    generatedAt: schema.scannedAt,
    tables: schema.tables.map((table) => ({ ...table, relationshipCount: counts.get(table.id) ?? 0 })),
    relationships,
    shopMap,
    summary: { tableCount: schema.tableCount, relationshipCount: relationships.length, fieldCount: schema.fieldCount, sampledRecords: summary.sampledRecords },
    quality,
  };
}

export default async function Page() {
  return <RelationshipExplorer data={await loadExplorerData()} />;
}
