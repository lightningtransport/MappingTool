import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ReadOnlyNinoxClient } from "../ninox/client.js";
import type { NinoxRecord, NinoxTableSchema } from "../ninox/types.js";

export const TRUCKSDB_TABLE_ID = "E";

export async function inspectTableMetadata(
  client: ReadOnlyNinoxClient,
  tableId = TRUCKSDB_TABLE_ID,
): Promise<NinoxTableSchema> {
  return client.getTable(tableId);
}

export async function writeTrucksDbOutput(
  table: NinoxTableSchema,
  outputRoot = resolve(process.cwd(), "output"),
): Promise<string> {
  const outputDir = resolve(outputRoot, "tables");
  const outputPath = resolve(outputDir, "trucksdb.json");
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(table, null, 2)}\n`, "utf8");
  return outputPath;
}

export async function sampleTrucksDb(
  client: ReadOnlyNinoxClient,
  limit?: number,
): Promise<NinoxRecord[]> {
  return client.getSampleRecords(TRUCKSDB_TABLE_ID, limit);
}

export async function writeTrucksDbSampleOutput(
  records: NinoxRecord[],
  outputRoot = resolve(process.cwd(), "output"),
): Promise<string> {
  const outputDir = resolve(outputRoot, "samples");
  const outputPath = resolve(outputDir, "trucksdb.json");
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  return outputPath;
}
