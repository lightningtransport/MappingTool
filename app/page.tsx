import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import RelationshipExplorer from "./relationship-explorer.js";
import type { ShopMapData } from "./types.js";

async function loadShopMap(): Promise<ShopMapData> {
  try {
    const raw = await readFile(resolve(process.cwd(), "output/analysis/shop-map.json"), "utf8");
    return JSON.parse(raw) as ShopMapData;
  } catch {
    return {
      generatedAt: new Date(0).toISOString(),
      anchor: { tableId: "E", tableName: "TrucksDB" },
      nodes: [{ tableId: "E", tableName: "TrucksDB", role: "anchor" }],
      edges: [],
      hypotheses: [],
    };
  }
}

export default async function Page() {
  const map = await loadShopMap();
  return <RelationshipExplorer map={map} />;
}
