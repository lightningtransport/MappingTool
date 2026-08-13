import { describe, expect, it } from "vitest";
import { analyzeRelationships, detectRelationshipsFromSamples } from "../src/scanner/relationshipAnalyzer.js";

describe("relationshipAnalyzer", () => {
  it("uses Ninox reference metadata and does not invent targets", () => {
    const result = analyzeRelationships({
      id: "E",
      name: "TrucksDB",
      fields: [
        { id: "AI", name: "Dispatchers", type: "ref", referenceToTable: "ZD", reverseField: "O" },
        { id: "X", name: "Unknown Ref", type: "ref" },
      ],
    }, [{ id: "E", name: "TrucksDB" }, { id: "ZD", name: "Team Members" }]);

    expect(result.counts).toEqual({ ninox: 1, detected: 0, unknown: 1 });
    expect(result.relationships[0]).toMatchObject({ source: "ninox", targetTable: "Team Members", confidence: 1 });
    expect(result.relationships[1]).toMatchObject({ source: "unknown", targetTable: "Unknown", confidence: 0 });
  });

  it("detects a relationship only after two sampled ID overlaps", () => {
    const result = detectRelationshipsFromSamples(
      [
        { id: "A", name: "Orders", fields: [{ id: "F", name: "Truck", type: "number" }] },
        { id: "B", name: "Truck", fields: [] },
      ],
      [
        { tableId: "A", tableName: "Orders", records: [{ id: 1, fields: { Truck: 10 } }, { id: 2, fields: { Truck: 11 } }] },
        { tableId: "B", tableName: "TrucksDB", records: [{ id: 10 }, { id: 11 }] },
      ],
    );
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]).toMatchObject({ source: "detected", targetTable: "Truck" });
  });
});
