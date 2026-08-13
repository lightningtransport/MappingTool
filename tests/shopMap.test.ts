import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildShopMap } from "../src/scanner/shopMap.js";

describe("shopMap", () => {
  it("builds an anchor map and preserves hypotheses", async () => {
    const root = await mkdtemp(join(tmpdir(), "ninox-shop-map-"));
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "relationships.json"), JSON.stringify({ relationships: [
      { sourceTable: "TrucksDB", sourceTableId: "E", sourceField: "Shop Main", sourceFieldId: "W", targetTable: "Shop Main", targetTableId: "PD", targetField: "id", reverseField: "H1", source: "ninox", confidence: 1 },
      { sourceTable: "Parts", sourceTableId: "XB", sourceField: "Truck", sourceFieldId: "A", targetTable: "TrucksDB", targetTableId: "E", targetField: "id", reverseField: "Unknown", source: "detected", confidence: 0.8 },
    ] }), "utf8");
    const result = await buildShopMap(root);
    expect(result.nodes.map((node) => node.tableId)).toEqual(["E", "PD", "XB"]);
    expect(result.hypotheses).toHaveLength(1);
  });
});
