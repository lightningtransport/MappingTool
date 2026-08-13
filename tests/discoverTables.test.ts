import { describe, expect, it } from "vitest";
import { discoverTables } from "../src/scanner/discoverTables.js";
import type { ReadOnlyNinoxClient } from "../src/ninox/client.js";

describe("discoverTables", () => {
  it("returns the live table payload and count", async () => {
    const client: ReadOnlyNinoxClient = {
      getDatabaseSchema: async () => ({}),
      getTables: async () => [{ id: "A", name: "Trucks" }, { id: "B", name: "Drivers" }],
      getTable: async () => ({}),
      getSampleRecords: async () => [],
    };

    const result = await discoverTables(client);
    expect(result.tableCount).toBe(2);
    expect(result.tables).toEqual([{ id: "A", name: "Trucks" }, { id: "B", name: "Drivers" }]);
    expect(result.scannedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
