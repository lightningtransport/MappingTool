import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DatabaseScanResult } from "../src/scanner/scanDatabase.js";
import { writeDatabaseScan } from "../src/scanner/scanDatabase.js";
import { buildStructuralSnapshot, diffStructuralSnapshots, readStructuralDiffHistory } from "../src/scanner/scanHistory.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function scan(scannedAt: string, tables: DatabaseScanResult["tables"], relationships: DatabaseScanResult["relationships"]["relationships"] = []): DatabaseScanResult {
  return {
    scannedAt,
    tableCount: tables.length,
    fieldCount: tables.reduce((count, table) => count + (Array.isArray(table.fields) ? table.fields.length : 0), 0),
    sampledRecords: 1,
    tables,
    relationships: { scannedAt, relationships, counts: { ninox: relationships.filter((item) => item.source === "ninox").length, detected: 0, unknown: 0 } },
    errors: [],
    samples: [{ tableId: "A", tableName: "Alpha", records: [{ id: 1, fields: { token: "Bearer record-secret" } }] }],
  };
}

describe("structural scan history", () => {
  it("builds a deterministic snapshot without records, formulas, or code values", () => {
    const result = scan("2026-08-14T00:00:00.000Z", [{
      id: "A",
      name: "Alpha",
      fields: [{ id: "F", name: "Owner", type: "ref", referenceToTable: "B", fn: "Bearer schema-secret" }],
    }]);
    const snapshot = buildStructuralSnapshot(result);
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.tables[0]?.fields[0]).toEqual({
      id: "F",
      name: "Owner",
      type: "ref",
      referenceToTable: "B",
      referenceFromTable: "Unknown",
      referenceFromField: "Unknown",
      reverseField: "Unknown",
    });
    expect(serialized).not.toContain("schema-secret");
    expect(serialized).not.toContain("record-secret");
  });

  it("creates an empty baseline and reports structural changes by stable IDs", () => {
    const previous = buildStructuralSnapshot(scan("2026-08-14T00:00:00.000Z", [
      { id: "A", name: "Alpha", fields: [{ id: "F1", name: "Old field", type: "text" }] },
      { id: "B", name: "Removed", fields: [] },
    ], [{ sourceTable: "Alpha", sourceTableId: "A", sourceField: "Old field", sourceFieldId: "F1", targetTable: "Removed", targetTableId: "B", targetField: "id", reverseField: "Unknown", source: "ninox", confidence: 1 }]));
    const current = buildStructuralSnapshot(scan("2026-08-14T01:00:00.000Z", [
      { id: "A", name: "Alpha renamed", fields: [{ id: "F1", name: "New field", type: "number" }, { id: "F2", name: "Added", type: "text" }] },
      { id: "C", name: "Added table", fields: [] },
    ], [{ sourceTable: "Alpha renamed", sourceTableId: "A", sourceField: "New field", sourceFieldId: "F1", targetTable: "Added table", targetTableId: "C", targetField: "id", reverseField: "Unknown", source: "ninox", confidence: 1 }]));

    const baseline = diffStructuralSnapshots(null, previous);
    const diff = diffStructuralSnapshots(previous, current);
    expect(baseline).toMatchObject({ baseline: true, fromScannedAt: null, summary: { total: 0 } });
    expect(diff).toMatchObject({
      baseline: false,
      summary: {
        tablesAdded: 1,
        tablesRemoved: 1,
        tablesRenamed: 1,
        fieldsAdded: 1,
        fieldsRemoved: 0,
        fieldsRenamed: 1,
        fieldsChanged: 1,
        relationshipsAdded: 1,
        relationshipsRemoved: 1,
        relationshipsChanged: 0,
      },
    });
    expect(diff.fields.changed[0]?.changedProperties).toEqual(["type"]);
  });

  it("keeps prior changes available after a later zero-change scan", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "ninox-history-"));
    roots.push(outputRoot);
    const first = scan("2026-08-14T00:00:00.000Z", [{ id: "A", name: "Alpha", fields: [] }]);
    const second = scan("2026-08-14T01:00:00.000Z", [{ id: "A", name: "Alpha", fields: [{ id: "F", name: "Added", type: "text" }] }]);
    const third = scan("2026-08-14T02:00:00.000Z", [{ id: "A", name: "Alpha", fields: [{ id: "F", name: "Added", type: "text" }] }]);

    await expect(writeDatabaseScan(first, outputRoot)).resolves.toMatchObject({ baseline: true });
    await expect(writeDatabaseScan(second, outputRoot)).resolves.toMatchObject({ baseline: false, summary: { total: 1 } });
    await expect(writeDatabaseScan(third, outputRoot)).resolves.toMatchObject({ baseline: false, summary: { total: 0 } });
    const snapshots = await readdir(join(outputRoot, "history", "snapshots"));
    const diffs = await readdir(join(outputRoot, "history", "diffs"));
    const latest = JSON.parse(await readFile(join(outputRoot, "history", "latest-diff.json"), "utf8")) as { fromScannedAt: string; toScannedAt: string; summary: { total: number } };
    const history = await readStructuralDiffHistory(outputRoot);
    expect(snapshots).toHaveLength(3);
    expect(diffs).toHaveLength(3);
    expect(latest).toEqual(expect.objectContaining({ fromScannedAt: second.scannedAt, toScannedAt: third.scannedAt, summary: expect.objectContaining({ total: 0 }) }));
    expect(history.map((entry) => entry.summary.total)).toEqual([0, 1, 0]);
  });
});
