import { describe, expect, it } from "vitest";
import { normalizeTableMetadata } from "../src/scanner/inspectMetadata.js";

describe("inspectMetadata", () => {
  it("preserves raw fields and marks unavailable relationships Unknown", () => {
    const result = normalizeTableMetadata({
      id: "E",
      name: "TrucksDB",
      fields: [
        { id: "A", name: "Truck", type: "number" },
        { id: "B", name: "Driver", type: "reference", relatedTable: "Drivers" },
      ],
    }, "E");

    expect(result.fieldCount).toBe(2);
    expect(result.fields[0]).toMatchObject({ id: "A", name: "Truck", type: "number", relationship: "Unknown", relatedTable: "Unknown" });
    expect(result.fields[1]).toMatchObject({ relationship: "Unknown", relatedTable: "Drivers" });
    expect(result.fields[1]?.raw).toEqual({ id: "B", name: "Driver", type: "reference", relatedTable: "Drivers" });
  });
});
