import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NinoxTableSchema } from "../ninox/types.js";
import type { ReadOnlyNinoxClient } from "../ninox/client.js";

export interface TableDiscoveryResult {
  scannedAt: string;
  tableCount: number;
  tables: NinoxTableSchema[];
}

export async function discoverTables(client: ReadOnlyNinoxClient): Promise<TableDiscoveryResult> {
  const tables = await client.getTables();
  return {
    scannedAt: new Date().toISOString(),
    tableCount: tables.length,
    tables,
  };
}

export async function writeSchemaOutput(result: TableDiscoveryResult): Promise<string> {
  const outputDir = resolve(process.cwd(), "output");
  const outputPath = resolve(outputDir, "schema.json");
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return outputPath;
}
