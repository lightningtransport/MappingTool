import { getNinoxConfig, loadEnvironment } from "../config/env.js";
import { AxiosReadOnlyNinoxClient } from "../ninox/client.js";
import { sanitizeError } from "../ninox/sanitize.js";
import { scanDatabase, writeDatabaseScan, type DatabaseScanResult } from "../scanner/scanDatabase.js";
import { writeShopMap } from "../scanner/shopMap.js";
import type { StructuralChangeSummary, StructuralDiff } from "../scanner/scanHistory.js";

export type ScanActionStatus = "idle" | "running" | "success" | "error";

export interface ScanActionState {
  status: ScanActionStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  counts: {
    tables: number;
    fields: number;
    sampledRecords: number;
    ninox: number;
    detected: number;
    unknown: number;
    errors: number;
  } | null;
  changes: StructuralChangeSummary | null;
  error: string | null;
}

export interface RescanDependencies {
  scan: () => Promise<DatabaseScanResult>;
  persist: (result: DatabaseScanResult) => Promise<StructuralDiff | null>;
}

let scanInProgress = false;

export async function runNinoxRescan(dependencies: RescanDependencies): Promise<ScanActionState> {
  if (scanInProgress) {
    return {
      status: "error",
      startedAt: null,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      counts: null,
      changes: null,
      error: "A Ninox scan is already running.",
    };
  }

  scanInProgress = true;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  try {
    const result = await dependencies.scan();
    const history = await dependencies.persist(result);
    return {
      status: "success",
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      counts: {
        tables: result.tableCount,
        fields: result.fieldCount,
        sampledRecords: result.sampledRecords,
        ninox: result.relationships.counts.ninox,
        detected: result.relationships.counts.detected,
        unknown: result.relationships.counts.unknown,
        errors: result.errors.length,
      },
      changes: history?.summary ?? null,
      error: null,
    };
  } catch (error) {
    return {
      status: "error",
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      counts: null,
      changes: null,
      error: sanitizeError(error).message,
    };
  } finally {
    scanInProgress = false;
  }
}

export async function executeNinoxRescan(): Promise<ScanActionState> {
  return runNinoxRescan({
    scan: () => {
      loadEnvironment();
      const client = new AxiosReadOnlyNinoxClient(getNinoxConfig());
      return scanDatabase(client, 5);
    },
    persist: async (result) => {
      const history = await writeDatabaseScan(result);
      await writeShopMap();
      return history;
    },
  });
}
