import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadExplorerData } from "../app/load-explorer-data.js";

describe("loadExplorerData", () => {
  it("returns an empty explorer with a load issue when scan artifacts are missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "ninox-explorer-empty-"));
    const data = await loadExplorerData(root);
    expect(data.tables).toEqual([]);
    expect(data.relationships).toEqual([]);
    expect(data.summary.tableCount).toBe(0);
    expect(data.quality.tables.total).toBe(0);
    expect(data.shopMap.anchor).toEqual({ tableId: "E", tableName: "TrucksDB" });
    expect(data.loadIssue).toContain("output/schema.json is missing");
    expect(data.loadIssue).toContain("output/relationships.json is missing");
    expect(data.catalog.issue).toBeNull();
  });

  it("synthesizes shop map and quality when only schema and relationships exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "ninox-explorer-partial-"));
    await mkdir(join(root, "output"), { recursive: true });
    await writeFile(join(root, "output", "schema.json"), JSON.stringify({
      scannedAt: "2026-09-19T00:00:00.000Z",
      tableCount: 2,
      fieldCount: 1,
      tables: [
        { id: "E", name: "TrucksDB", fields: [{ id: "W", name: "Shop Main", type: "ref", referenceToTable: "PD" }] },
        { id: "PD", name: "Shop Main", fields: [] },
      ],
    }), "utf8");
    await writeFile(join(root, "output", "relationships.json"), JSON.stringify({
      relationships: [{
        sourceTable: "TrucksDB", sourceTableId: "E", sourceField: "Shop Main", sourceFieldId: "W",
        targetTable: "Shop Main", targetTableId: "PD", targetField: "id", reverseField: "Unknown",
        source: "ninox", confidence: 1,
      }],
    }), "utf8");

    const data = await loadExplorerData(root);
    expect(data.tables.map((table) => table.id)).toEqual(["E", "PD"]);
    expect(data.relationships).toHaveLength(1);
    expect(data.shopMap.nodes.map((node) => node.tableId)).toEqual(["E", "PD"]);
    expect(data.quality.relationships.confirmed).toBe(1);
    expect(data.loadIssue).toBeNull();
  });
});
