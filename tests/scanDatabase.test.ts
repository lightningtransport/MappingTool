import { describe, expect, it } from "vitest";
import type { ReadOnlyNinoxClient } from "../src/ninox/client.js";
import { scanDatabase } from "../src/scanner/scanDatabase.js";

describe("scanDatabase", () => {
  it("inspects all catalog tables and aggregates relationships", async () => {
    const client: ReadOnlyNinoxClient = {
      getDatabaseSchema: async () => ({}),
      getTables: async () => [{ id: "E", name: "TrucksDB" }, { id: "ZD", name: "Team Members" }],
      getTable: async (id) => id === "E"
        ? { id: "E", name: "TrucksDB", fields: [{ id: "A", name: "Dispatcher", type: "ref", referenceToTable: "ZD" }] }
        : { id: "ZD", name: "Team Members", fields: [] },
      getSampleRecords: async () => [{ id: 1 }],
    };

    const result = await scanDatabase(client, 2);
    expect(result.tableCount).toBe(2);
    expect(result.fieldCount).toBe(1);
    expect(result.relationships.counts.ninox).toBe(1);
    expect(result.sampledRecords).toBe(2);
    expect(result.errors).toEqual([]);
  });
});
