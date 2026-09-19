import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Relationship } from "./relationshipAnalyzer.js";

/** Documented Shop/TrucksDB identity from P0 scan evidence and data-reporting-kit (`TrucksDB (E)`). */
export const DOCUMENTED_SHOP_ANCHOR = { tableId: "E", tableName: "TrucksDB" } as const;

export interface ShopMap {
  generatedAt: string;
  anchor: { tableId: string; tableName: string };
  nodes: { tableId: string; tableName: string; role: "anchor" | "related" }[];
  edges: Relationship[];
  hypotheses: Relationship[];
}

export function resolveShopAnchor(tables: { id?: unknown; name?: unknown }[] = []): { tableId: string; tableName: string } {
  const byId = tables.find((table) => table.id === DOCUMENTED_SHOP_ANCHOR.tableId);
  if (byId) {
    return {
      tableId: DOCUMENTED_SHOP_ANCHOR.tableId,
      tableName: typeof byId.name === "string" && byId.name.trim() ? byId.name : DOCUMENTED_SHOP_ANCHOR.tableName,
    };
  }
  const byName = tables.find((table) => table.name === DOCUMENTED_SHOP_ANCHOR.tableName && typeof table.id === "string" && table.id.trim());
  if (byName && typeof byName.id === "string") {
    return { tableId: byName.id, tableName: DOCUMENTED_SHOP_ANCHOR.tableName };
  }
  return { tableId: DOCUMENTED_SHOP_ANCHOR.tableId, tableName: DOCUMENTED_SHOP_ANCHOR.tableName };
}

export function shopMapFromRelationships(
  relationships: Relationship[],
  tables: { id?: unknown; name?: unknown }[] = [],
  generatedAt = new Date().toISOString(),
): ShopMap {
  const anchor = resolveShopAnchor(tables);
  const edges = relationships.filter((edge) => edge.sourceTableId === anchor.tableId || edge.targetTableId === anchor.tableId);
  const unique = new Map<string, { tableId: string; tableName: string; role: "anchor" | "related" }>();
  unique.set(anchor.tableId, { tableId: anchor.tableId, tableName: anchor.tableName, role: "anchor" });
  for (const edge of edges) {
    const id = edge.sourceTableId === anchor.tableId ? edge.targetTableId : edge.sourceTableId;
    const name = edge.sourceTableId === anchor.tableId ? edge.targetTable : edge.sourceTable;
    if (id !== anchor.tableId) unique.set(id, { tableId: id, tableName: name, role: "related" });
  }
  return {
    generatedAt,
    anchor,
    nodes: [...unique.values()],
    edges,
    hypotheses: edges.filter((edge) => edge.source === "detected"),
  };
}

export async function buildShopMap(outputRoot = resolve(process.cwd(), "output")): Promise<ShopMap> {
  const relationships = JSON.parse(await readFile(resolve(outputRoot, "relationships.json"), "utf8")) as { relationships: Relationship[] };
  let tables: { id?: unknown; name?: unknown }[] = [];
  try {
    const schema = JSON.parse(await readFile(resolve(outputRoot, "schema.json"), "utf8")) as { tables?: { id?: unknown; name?: unknown }[] };
    tables = Array.isArray(schema.tables) ? schema.tables : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return shopMapFromRelationships(relationships.relationships, tables);
}

export async function writeShopMap(outputRoot = resolve(process.cwd(), "output")): Promise<string> {
  const result = await buildShopMap(outputRoot);
  await mkdir(resolve(outputRoot, "analysis"), { recursive: true });
  const outputPath = resolve(outputRoot, "analysis", "shop-map.json");
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return outputPath;
}
