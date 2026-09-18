import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CatalogAnnotations } from "./types.js";
import { DEFAULT_CATALOG_ROOT } from "./store.js";

export interface CatalogExportResult { jsonPath: string; markdownPath: string }

function list(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "Unknown";
}

export function catalogMarkdown(catalog: CatalogAnnotations): string {
  const lines = [
    "# Ninox reviewed data catalog",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "> Human-reviewed and approved external knowledge only. No record values are included.",
    "",
    "## Tables",
    "",
  ];
  for (const review of Object.values(catalog.tables).sort((a, b) => a.tableId.localeCompare(b.tableId))) {
    lines.push(`### ${review.tableId}`, "", review.description || "Unknown", "", `- Status: ${review.status}`, `- Grain: ${review.grain || "Unknown"}`, `- Business keys: ${list(review.businessKeyFieldIds)}`, `- Criticality: ${review.criticality}`, `- Use for: ${list(review.useFor)}`, `- Do not use for: ${list(review.doNotUseFor)}`, `- Tags: ${list(review.tags)}`, "");
  }
  lines.push("## Fields", "");
  for (const review of Object.values(catalog.fields).sort((a, b) => `${a.tableId}:${a.fieldId}`.localeCompare(`${b.tableId}:${b.fieldId}`))) {
    lines.push(`### ${review.tableId}.${review.fieldId}`, "", review.description || "Unknown", "", `- Role: ${review.role}`, `- Sensitive: ${review.sensitive ? "Yes" : "No"}`, `- Criticality: ${review.criticality}`, `- Safe use: ${review.safeUse || "Unknown"}`, "");
  }
  lines.push("## Relationships", "");
  for (const review of Object.values(catalog.relationships)) {
    lines.push(`- **${review.sourceTableId}.${review.sourceFieldId} → ${review.targetTableId}** — ${review.decision}; ${review.cardinality}; ${review.joinRule || "join rule Unknown"}`);
  }
  lines.push("", "## Consumers", "");
  for (const consumer of Object.values(catalog.consumers).sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`### ${consumer.name}`, "", consumer.purpose || "Unknown", "", `- Kind: ${consumer.kind}`, `- Tables: ${list(consumer.tableIds)}`, `- Fields: ${list(consumer.fieldKeys)}`, `- Filters: ${list(consumer.filters)}`, `- Joins: ${list(consumer.joins)}`, `- Freshness limitations: ${list(consumer.freshnessLimitations)}`, "");
  }
  return `${lines.join("\n").trim()}\n`;
}

export async function writeCatalogExports(catalog: CatalogAnnotations, root = DEFAULT_CATALOG_ROOT): Promise<CatalogExportResult> {
  const exportRoot = resolve(root, "exports");
  await mkdir(exportRoot, { recursive: true });
  const jsonPath = resolve(exportRoot, "catalog.json");
  const markdownPath = resolve(exportRoot, "catalog.md");
  const safeCatalog = { ...catalog, candidates: {} };
  for (const [path, content] of [
    [jsonPath, `${JSON.stringify(safeCatalog, null, 2)}\n`],
    [markdownPath, catalogMarkdown(catalog)],
  ] as const) {
    const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, content, "utf8");
    await rename(temporary, path);
  }
  return { jsonPath, markdownPath };
}
