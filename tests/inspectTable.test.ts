import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ReadOnlyNinoxClient } from "../src/ninox/client.js";
import { inspectTableMetadata, sampleTrucksDb, writeTrucksDbOutput, writeTrucksDbSampleOutput } from "../src/scanner/inspectTable.js";

describe("TrucksDB metadata inspection", () => {
  it("uses table ID E and persists the complete raw payload", async () => {
    const raw = { id: "E", name: "TrucksDB", fields: [{ id: "f1", type: "custom" }], extra: { unknown: true } };
    const getTable = vi.fn().mockResolvedValue(raw);
    const client: ReadOnlyNinoxClient = {
      getDatabaseSchema: async () => ({}),
      getTables: async () => [],
      getTable,
      getSampleRecords: async () => [],
    };
    const outputRoot = await mkdtemp(join(tmpdir(), "ninox-data-mapper-"));

    const result = await inspectTableMetadata(client);
    const outputPath = await writeTrucksDbOutput(result, outputRoot);

    expect(getTable).toHaveBeenCalledWith("E");
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(raw);
    expect(outputPath).toBe(join(outputRoot, "tables", "trucksdb.json"));
  });
});

describe("TrucksDB record sampling", () => {
  it("uses table E and preserves raw records", async () => {
    const raw = [{ id: "r1", fields: { status: "active" }, extra: { unknown: true } }];
    const getSampleRecords = vi.fn().mockResolvedValue(raw);
    await expect(sampleTrucksDb({ getSampleRecords } as never, 20)).resolves.toBe(raw);
    expect(getSampleRecords).toHaveBeenCalledWith("E", 20);
  });

  it("writes the raw sample payload under samples/trucksdb.json", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "ninox-data-mapper-"));
    const raw = [{ id: "r1", extra: { unknown: true } }];
    const outputPath = await writeTrucksDbSampleOutput(raw, outputRoot);
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(raw);
    expect(outputPath).toBe(join(outputRoot, "samples", "trucksdb.json"));
  });
});
