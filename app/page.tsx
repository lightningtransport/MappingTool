import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import RelationshipExplorer from "./relationship-explorer.js";
import type { ShopMapData } from "./types.js";

async function loadShopMap(): Promise<ShopMapData> {
  try {
    const raw = await readFile(resolve(process.cwd(), "output/analysis/shop-map.json"), "utf8");
    const map = JSON.parse(raw) as ShopMapData;
    const schema = JSON.parse(await readFile(resolve(process.cwd(), "output/schema.json"), "utf8")) as { tables: { id: string; name: string }[] };
    const counts = new Map<string, number>();
    for (const edge of map.edges) {
      counts.set(edge.sourceTableId, (counts.get(edge.sourceTableId) ?? 0) + 1);
      counts.set(edge.targetTableId, (counts.get(edge.targetTableId) ?? 0) + 1);
    }
    return { ...map, allTables: schema.tables.map((table) => ({ tableId: table.id, tableName: table.name, relationshipCount: counts.get(table.id) ?? 0 })) };
  } catch {
    return {
      generatedAt: new Date(0).toISOString(),
      anchor: { tableId: "E", tableName: "TrucksDB" },
      nodes: [{ tableId: "E", tableName: "TrucksDB", role: "anchor" }],
      edges: [],
      hypotheses: [],
      allTables: [{ tableId: "E", tableName: "TrucksDB", relationshipCount: 0 }],
    };
  }
}

export default async function Page() {
  const map = await loadShopMap();
  return <RelationshipExplorer map={map} />;
}
