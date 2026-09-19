import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReadOnlyNinoxClient } from "../src/ninox/client.js";
import { scanDatabase, writeDatabaseScan } from "../src/scanner/scanDatabase.js";

describe("scanDatabase", () => {
  it("inspects all catalog tables and aggregates relationships", async () => {
    const client: ReadOnlyNinoxClient = {
      getDatabaseSchema: async () => ({}),
      getTables: async () => [{ id: "E", name: "TrucksDB" }, { id: "ZD", name: "Team Members" }],
      getTable: async (id) => id === "E"
        ? { id: "E", name: "TrucksDB", fields: [{ id: "A", name: "Dispatcher", type: "ref", referenceToTable: "ZD" }] }
        : { id: "ZD", name: "Team Members", fields: [{ id: "R", name: "Trucks", type: "rev", referenceFromTable: "E", referenceFromField: "A" }] },
      getSampleRecords: async () => [{ id: 1 }],
    };

    const result = await scanDatabase(client, 2);
    expect(result.tableCount).toBe(2);
    expect(result.fieldCount).toBe(2);
    expect(result.relationships.counts.ninox).toBe(1);
    expect(result.sampledRecords).toBe(2);
    expect(result.errors).toEqual([]);

    const outputRoot = await mkdtemp(join(tmpdir(), "ninox-data-mapper-"));
    try {
      await writeDatabaseScan(result, outputRoot);
      const quality = JSON.parse(await readFile(join(outputRoot, "analysis", "data-quality.json"), "utf8")) as { tables: { connected: number }; relationships: { confirmed: number } };
      expect(quality.tables.connected).toBe(2);
      expect(quality.relationships.confirmed).toBe(1);
      const shopMap = JSON.parse(await readFile(join(outputRoot, "analysis", "shop-map.json"), "utf8")) as { anchor: { tableId: string }; nodes: { tableId: string }[] };
      expect(shopMap.anchor.tableId).toBe("E");
      expect(shopMap.nodes.map((node) => node.tableId)).toEqual(["E", "ZD"]);
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });
});
