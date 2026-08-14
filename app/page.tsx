import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import RelationshipExplorer from "./relationship-explorer.js";
import { normalizeExplorerFields, relationshipCounts, summarizeStructuralDiff, type ExplorerData, type ExplorerRelationship } from "./explorer-data.js";
import type { ShopMapData } from "./types.js";
import type { DataQualityReport } from "../src/scanner/dataQuality.js";
import { readStructuralDiffHistory } from "../src/scanner/scanHistory.js";
import type { NinoxTableSchema } from "../src/ninox/types.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(resolve(process.cwd(), relativePath), "utf8")) as T;
}

export async function loadExplorerData(): Promise<ExplorerData> {
  const [schema, relationshipArtifact, summary, shopMap, quality, history] = await Promise.all([
    readJson<{ scannedAt: string; tableCount: number; fieldCount: number; tables: NinoxTableSchema[] }>("output/schema.json"),
    readJson<{ scannedAt: string; relationships: Record<string, unknown>[] }>("output/relationships.json"),
    readJson<{ tableCount: number; fieldCount: number; sampledRecords: number; relationships: { ninox?: number; detected?: number; unknown?: number } }>("output/scan-summary.json"),
    readJson<ShopMapData>("output/analysis/shop-map.json"),
    readJson<DataQualityReport>("output/analysis/data-quality.json"),
    readStructuralDiffHistory(),
  ]);
  const relationships = relationshipArtifact.relationships.map((raw) => {
    const relationship = raw as Partial<ExplorerRelationship>;
    const source = relationship.source === "ninox" || relationship.source === "detected" || relationship.source === "unknown" ? relationship.source : "unknown";
    const metadata = raw.metadata as { reverseValidated?: boolean } | undefined;
    const provenance = source === "ninox"
      ? metadata?.reverseValidated ? "Ninox ref + rev" : "Ninox ref"
      : source === "detected" ? "sample overlap"
      : "unresolved Ninox ref";
    return { ...relationship, source, provenance, raw } as ExplorerRelationship;
  });
  const counts = relationshipCounts(relationships);
  return {
    generatedAt: schema.scannedAt,
    tables: schema.tables.map((table) => ({ id: typeof table.id === "string" ? table.id : "Unknown", name: typeof table.name === "string" ? table.name : "Unknown", fields: normalizeExplorerFields(table.fields), relationshipCount: counts.get(table.id ?? "Unknown") ?? 0 })),
    relationships,
    shopMap,
    summary: { tableCount: schema.tableCount, relationshipCount: relationships.length, fieldCount: schema.fieldCount, sampledRecords: summary.sampledRecords },
    quality,
    history: history.map((diff) => summarizeStructuralDiff(diff)).filter((item): item is NonNullable<typeof item> => item !== null),
  };
}

export default async function Page() {
  return <RelationshipExplorer data={await loadExplorerData()} />;
}
