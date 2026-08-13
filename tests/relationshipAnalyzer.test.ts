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
        { id: "Y", name: "Missing Table", type: "ref", referenceToTable: "UC" },
      ],
    }, [
      { id: "E", name: "TrucksDB" },
      { id: "ZD", name: "Team Members", fields: [{ id: "O", name: "Trucks", type: "rev", referenceFromTable: "E", referenceFromField: "AI" }] },
    ]);

    expect(result.counts).toEqual({ ninox: 1, detected: 0, unknown: 2 });
    expect(result.relationships[0]).toMatchObject({ source: "ninox", targetTable: "Team Members", reverseField: "O", confidence: 1, metadata: { reverseType: "rev", reverseValidated: true } });
    expect(result.relationships[1]).toMatchObject({ source: "unknown", targetTable: "Unknown", confidence: 0 });
    expect(result.relationships[2]).toMatchObject({ source: "unknown", targetTableId: "UC", targetTable: "Unknown", confidence: 0 });
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

  it("does not infer a duplicate relationship from Ninox reverse metadata", () => {
    const result = detectRelationshipsFromSamples(
      [
        { id: "A", name: "Orders", fields: [{ id: "R", name: "Truck", type: "rev", referenceFromTable: "B", referenceFromField: "F" }] },
        { id: "B", name: "Truck", fields: [{ id: "F", name: "Order", type: "ref", referenceToTable: "A", reverseField: "R" }] },
      ],
      [
        { tableId: "A", tableName: "Orders", records: [{ id: 1, fields: { Truck: 10 } }, { id: 2, fields: { Truck: 11 } }] },
        { tableId: "B", tableName: "Truck", records: [{ id: 10 }, { id: 11 }] },
      ],
    );

    expect(result.relationships).toEqual([]);
  });
});
