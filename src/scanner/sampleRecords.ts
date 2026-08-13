import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ReadOnlyNinoxClient } from "../ninox/client.js";
import type { NinoxRecord } from "../ninox/types.js";

export const TRUCKSDB_TABLE_ID = "E";

export interface SampleRecordsResult {
  scannedAt: string;
  tableId: string;
  requestedLimit: number;
  recordCount: number;
  records: NinoxRecord[];
}

export async function sampleRecords(
  client: ReadOnlyNinoxClient,
  tableId = TRUCKSDB_TABLE_ID,
  limit = 20,
): Promise<SampleRecordsResult> {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error("Sample limit must be a positive integer");
  }
  const records = await client.getSampleRecords(tableId, limit);
  return {
    scannedAt: new Date().toISOString(),
    tableId,
    requestedLimit: limit,
    recordCount: records.length,
    records,
  };
}

export async function writeSampleOutput(
  result: SampleRecordsResult,
  outputRoot = resolve(process.cwd(), "output"),
): Promise<string> {
  const outputDir = resolve(outputRoot, "samples");
  const outputPath = resolve(outputDir, "trucksdb.json");
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return outputPath;
}
