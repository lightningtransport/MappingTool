import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ReadOnlyNinoxClient } from "../src/ninox/client.js";
import { sampleRecords, writeSampleOutput } from "../src/scanner/sampleRecords.js";

describe("sampleRecords", () => {
  it("uses TrucksDB and the default limit", async () => {
    const getSampleRecords = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const client = { getSampleRecords } as unknown as ReadOnlyNinoxClient;

    const result = await sampleRecords(client);

    expect(getSampleRecords).toHaveBeenCalledWith("E", 20);
    expect(result.recordCount).toBe(2);
    expect(result.tableId).toBe("E");
  });

  it("persists the raw records payload", async () => {
    const root = await mkdtemp(join(tmpdir(), "ninox-data-mapper-"));
    const result = {
      scannedAt: new Date().toISOString(),
      tableId: "E",
      requestedLimit: 20,
      recordCount: 1,
      records: [{ id: 1, fields: { Truck: "787" } }],
    };

    const outputPath = await writeSampleOutput(result, root);
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(result);
  });
});
