import { describe, expect, it } from "vitest";
import { buildDataQualityReport } from "../src/scanner/dataQuality.js";
import type { Relationship } from "../src/scanner/relationshipAnalyzer.js";

const relationship = (sourceTableId: string, targetTableId: string, source: Relationship["source"]): Relationship => ({
  sourceTable: sourceTableId,
  sourceTableId,
  sourceField: "Reference",
  sourceFieldId: "F",
  targetTable: targetTableId === "Unknown" ? "Unknown" : targetTableId,
  targetTableId,
  targetField: "id",
  reverseField: "Unknown",
  source,
  confidence: source === "ninox" ? 1 : source === "detected" ? 0.8 : 0,
});

describe("data quality report", () => {
  it("separates confirmed relationships, hypotheses, isolated tables, and unresolved references", () => {
    const report = buildDataQualityReport({
      scannedAt: "2026-08-13T00:00:00.000Z",
      tables: ["A", "B", "C", "D", "E"].map((id) => ({ id, name: `Table ${id}` })),
      relationships: [
        relationship("A", "B", "ninox"),
        relationship("C", "D", "detected"),
        relationship("E", "Unknown", "unknown"),
        relationship("A", "MISSING", "ninox"),
      ],
      errors: [{ tableId: "E", message: "Unable to sample table records" }],
    });

    expect(report.tables).toEqual({ total: 5, connected: 4, isolated: 1, hypothesisOnly: 2 });
    expect(report.relationships).toEqual({ confirmed: 2, detected: 1, unknown: 1 });
    expect(report.isolatedTables.map((table) => table.tableId)).toEqual(["E"]);
    expect(report.hypothesisOnlyTables.map((table) => table.tableId)).toEqual(["C", "D"]);
    expect(report.inferredRelationships).toHaveLength(1);
    expect(report.unresolvedReferences.map((item) => item.reason)).toEqual(["missing-target-id", "target-not-in-schema"]);
    expect(report.scanErrors).toHaveLength(1);
  });

  it("does not classify a detected relationship as confirmed", () => {
    const report = buildDataQualityReport({
      scannedAt: "2026-08-13T00:00:00.000Z",
      tables: [{ id: "A", name: "A" }, { id: "B", name: "B" }],
      relationships: [relationship("A", "B", "detected")],
      errors: [],
    });

    expect(report.relationships.confirmed).toBe(0);
    expect(report.relationships.detected).toBe(1);
    expect(report.tables.hypothesisOnly).toBe(2);
  });
});
