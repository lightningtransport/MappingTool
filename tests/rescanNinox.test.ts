import { describe, expect, it, vi } from "vitest";
import type { DatabaseScanResult } from "../src/scanner/scanDatabase.js";
import { runNinoxRescan } from "../src/rescan/rescanNinox.js";

const result: DatabaseScanResult = {
  scannedAt: "2026-08-13T00:00:00.000Z",
  tableCount: 2,
  fieldCount: 3,
  sampledRecords: 4,
  tables: [],
  relationships: {
    scannedAt: "2026-08-13T00:00:00.000Z",
    relationships: [],
    counts: { ninox: 1, detected: 0, unknown: 1 },
  },
  errors: [{ tableId: "B", message: "Unable to sample table records" }],
  samples: [],
};

describe("runNinoxRescan", () => {
  it("returns serializable counts after persisting a successful scan", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const state = await runNinoxRescan({ scan: async () => result, persist });

    expect(state.status).toBe("success");
    expect(state.counts).toEqual({ tables: 2, fields: 3, sampledRecords: 4, ninox: 1, detected: 0, unknown: 1, errors: 1 });
    expect(state.startedAt).toEqual(expect.any(String));
    expect(state.finishedAt).toEqual(expect.any(String));
    expect(state.durationMs).toEqual(expect.any(Number));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(persist).toHaveBeenCalledWith(result);
  });

  it("rejects a concurrent scan without starting or persisting it", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const firstScan = vi.fn(async () => { await gate; return result; });
    const first = runNinoxRescan({ scan: firstScan, persist: async () => undefined });
    const secondScan = vi.fn(async () => result);
    const second = await runNinoxRescan({ scan: secondScan, persist: async () => undefined });

    expect(second).toMatchObject({ status: "error", error: "A Ninox scan is already running." });
    expect(secondScan).not.toHaveBeenCalled();
    release();
    await expect(first).resolves.toMatchObject({ status: "success" });
  });

  it("sanitizes scanner failures", async () => {
    const state = await runNinoxRescan({
      scan: async () => { throw new Error("Bearer private-token-value"); },
      persist: async () => undefined,
    });

    expect(state).toMatchObject({ status: "error", error: "Unexpected Ninox client error", counts: null });
    expect(JSON.stringify(state)).not.toContain("private-token-value");
  });
});
