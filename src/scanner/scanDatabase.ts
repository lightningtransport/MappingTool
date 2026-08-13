import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ReadOnlyNinoxClient } from "../ninox/client.js";
import type { NinoxRecord, NinoxTableSchema } from "../ninox/types.js";
import { buildDataQualityReport, writeDataQualityReport } from "./dataQuality.js";
import { analyzeRelationships, detectRelationshipsFromSamples, type RelationshipResult } from "./relationshipAnalyzer.js";

export interface DatabaseScanResult {
  scannedAt: string;
  tableCount: number;
  fieldCount: number;
  tables: NinoxTableSchema[];
  relationships: RelationshipResult;
  errors: { tableId: string; message: string }[];
  sampledRecords: number;
  samples: { tableId: string; tableName: string; records: NinoxRecord[] }[];
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function consume(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const value = await worker(items[index] as T);
      results[index] = value;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => consume()));
  return results;
}

export async function scanDatabase(client: ReadOnlyNinoxClient, concurrency = 5): Promise<DatabaseScanResult> {
  const catalog = await client.getTables();
  const errors: { tableId: string; message: string }[] = [];
  const inspected = await mapWithConcurrency(catalog, concurrency, async (table) => {
    const tableId = typeof table.id === "string" ? table.id : "Unknown";
    try {
      return await client.getTable(tableId);
    } catch {
      errors.push({ tableId, message: "Unable to inspect table metadata" });
      return table;
    }
  });
  const declaredRelationships = inspected.reduce<RelationshipResult>(
    (result, table) => {
      const current = analyzeRelationships(table, inspected);
      result.relationships.push(...current.relationships);
      result.counts.ninox += current.counts.ninox;
      result.counts.detected += current.counts.detected;
      result.counts.unknown += current.counts.unknown;
      return result;
    },
    { scannedAt: new Date().toISOString(), relationships: [], counts: { ninox: 0, detected: 0, unknown: 0 } },
  );
  const sampleResults = await mapWithConcurrency(inspected, concurrency, async (table) => {
    const tableId = typeof table.id === "string" ? table.id : "Unknown";
    try {
      return await client.getSampleRecords(tableId);
    } catch {
      errors.push({ tableId, message: "Unable to sample table records" });
      return [] as NinoxRecord[];
    }
  });
  const samples = inspected.map((table, index) => ({
    tableId: typeof table.id === "string" ? table.id : "Unknown",
    tableName: typeof table.name === "string" ? table.name : "Unknown",
    records: sampleResults[index] ?? [],
  }));
  const detectedRelationships = detectRelationshipsFromSamples(inspected, samples);
  const relationships: RelationshipResult = {
    scannedAt: new Date().toISOString(),
    relationships: [...declaredRelationships.relationships, ...detectedRelationships.relationships],
    counts: {
      ninox: declaredRelationships.counts.ninox,
      detected: detectedRelationships.counts.detected,
      unknown: declaredRelationships.counts.unknown,
    },
  };
  return {
    scannedAt: new Date().toISOString(),
    tableCount: inspected.length,
    fieldCount: inspected.reduce((count, table) => count + (Array.isArray(table.fields) ? table.fields.length : 0), 0),
    tables: inspected,
    relationships,
    errors,
    sampledRecords: sampleResults.reduce((count, records) => count + records.length, 0),
    samples,
  };
}

export async function writeDatabaseScan(result: DatabaseScanResult, outputRoot = resolve(process.cwd(), "output")): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  const samplesDir = resolve(outputRoot, "samples");
  await mkdir(samplesDir, { recursive: true });
  await writeFile(resolve(outputRoot, "schema.json"), `${JSON.stringify({ scannedAt: result.scannedAt, tableCount: result.tableCount, fieldCount: result.fieldCount, tables: result.tables }, null, 2)}\n`, "utf8");
  await writeFile(resolve(outputRoot, "relationships.json"), `${JSON.stringify(result.relationships, null, 2)}\n`, "utf8");
  await writeFile(resolve(outputRoot, "scan-summary.json"), `${JSON.stringify({ scannedAt: result.scannedAt, tableCount: result.tableCount, fieldCount: result.fieldCount, sampledRecords: result.sampledRecords, relationships: result.relationships.counts, errors: result.errors }, null, 2)}\n`, "utf8");
  await writeDataQualityReport(buildDataQualityReport({ scannedAt: result.scannedAt, tables: result.tables, relationships: result.relationships.relationships, errors: result.errors }), outputRoot);
  await Promise.all(result.samples.map((sample) => {
    const safeName = sample.tableName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || sample.tableId;
    return writeFile(resolve(samplesDir, `${safeName}-${sample.tableId}.json`), `${JSON.stringify({ tableId: sample.tableId, tableName: sample.tableName, records: sample.records }, null, 2)}\n`, "utf8");
  }));
}
