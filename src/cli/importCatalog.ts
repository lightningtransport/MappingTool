import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NinoxTableSchema } from "../ninox/types.js";
import { buildReportingKitCandidates, loadReportingKitMetadata, mergeImportCandidates } from "../catalog/importReportingKit.js";
import { mutateCatalog, readCatalog } from "../catalog/store.js";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const sourcePath = argument("--path");
const dryRun = process.argv.includes("--dry-run");
if (!sourcePath) {
  console.error("Usage: npm run catalog:import -- --path /path/to/data-reporting-kit [--dry-run]");
  process.exitCode = 1;
} else {
  try {
    const schema = JSON.parse(await readFile(resolve(process.cwd(), "output/schema.json"), "utf8")) as { tables?: NinoxTableSchema[] };
    const { metadata, sourceHash } = await loadReportingKitMetadata(sourcePath);
    const result = buildReportingKitCandidates(metadata, Array.isArray(schema.tables) ? schema.tables : [], sourceHash);
    const current = await readCatalog();
    if (current.issue) throw new Error(current.issue);
    const merged = mergeImportCandidates(structuredClone(current.catalog), result.candidates);
    const pending = Object.values(merged.candidates).filter((candidate) => candidate.decision === "pending").length;
    if (!dryRun) await mutateCatalog((catalog) => mergeImportCandidates(catalog, result.candidates));
    console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "write", sourceVersion: metadata.schemaVersion, candidates: result.candidates.length, pending, ignoredMappings: result.ignoredMappings.length }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to import catalog candidates");
    process.exitCode = 1;
  }
}
