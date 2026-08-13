import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Relationship } from "./relationshipAnalyzer.js";

export interface ShopMap {
  generatedAt: string;
  anchor: { tableId: string; tableName: string };
  nodes: { tableId: string; tableName: string; role: "anchor" | "related" }[];
  edges: Relationship[];
  hypotheses: Relationship[];
}

export async function buildShopMap(outputRoot = resolve(process.cwd(), "output")): Promise<ShopMap> {
  const relationships = JSON.parse(await readFile(resolve(outputRoot, "relationships.json"), "utf8")) as { relationships: Relationship[] };
  const edges = relationships.relationships.filter((edge) => edge.sourceTableId === "E" || edge.targetTableId === "E");
  const unique = new Map<string, { tableId: string; tableName: string; role: "anchor" | "related" }>();
  unique.set("E", { tableId: "E", tableName: "TrucksDB", role: "anchor" });
  for (const edge of edges) {
    const id = edge.sourceTableId === "E" ? edge.targetTableId : edge.sourceTableId;
    const name = edge.sourceTableId === "E" ? edge.targetTable : edge.sourceTable;
    if (id !== "E") unique.set(id, { tableId: id, tableName: name, role: "related" });
  }
  return {
    generatedAt: new Date().toISOString(),
    anchor: { tableId: "E", tableName: "TrucksDB" },
    nodes: [...unique.values()],
    edges,
    hypotheses: edges.filter((edge) => edge.source === "detected"),
  };
}

export async function writeShopMap(outputRoot = resolve(process.cwd(), "output")): Promise<string> {
  const result = await buildShopMap(outputRoot);
  await mkdir(resolve(outputRoot, "analysis"), { recursive: true });
  const outputPath = resolve(outputRoot, "analysis", "shop-map.json");
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return outputPath;
}
