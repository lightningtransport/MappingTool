import { describe, expect, it } from "vitest";
import { filterRelationships, normalizeExplorerFields, preserveExplorerScope, preserveShopScope, relationshipCounts, scopedRelationships, tableIdForShopScope, type ExplorerRelationship } from "../app/explorer-data.js";

const edges = [
  { sourceTableId: "A", targetTableId: "B", source: "ninox" },
  { sourceTableId: "B", targetTableId: "C", source: "detected" },
  { sourceTableId: "C", targetTableId: "A", source: "unknown" },
] as ExplorerRelationship[];

describe("explorer relationship logic", () => {
  it("keeps all relationships as the complete database scope and exact edges in the secondary scope", () => {
    expect(scopedRelationships("all", edges, [edges[0]!])).toEqual(edges);
    expect(scopedRelationships("shop", edges, [edges[0]!])).toEqual([edges[0]]);
  });
  it("counts every relationship at both endpoints", () => {
    expect(Object.fromEntries(relationshipCounts(edges))).toEqual({ A: 2, B: 2, C: 2 });
  });

  it("filters source and direction for a selected table", () => {
    expect(filterRelationships(edges, "all", "all", "B")).toHaveLength(2);
    expect(filterRelationships(edges, "all", "all", "missing")).toHaveLength(0);
    expect(filterRelationships(edges, "detected", "outgoing", "B")).toHaveLength(1);
    expect(filterRelationships(edges, "unknown", "incoming", "A")).toHaveLength(1);
    expect(filterRelationships(edges, "ninox", "incoming", "A")).toHaveLength(0);
  });

  it("keeps reporting-kit scope on tables that touch declared IDs, not as invented edges", () => {
    const reporting = scopedRelationships("reporting", edges, [edges[0]!], ["A"]);
    expect(reporting).toEqual([edges[0], edges[2]]);
  });

  it("uses only the exact Shop map edge set in Shop scope", () => {
    const shopEdge = edges[0]!;
    const unrelatedEdgeTouchingAnchor = { sourceTableId: "E", targetTableId: "C", source: "unknown" } as ExplorerRelationship;
    expect(scopedRelationships("shop", [shopEdge, unrelatedEdgeTouchingAnchor], [shopEdge])).toEqual([shopEdge]);
    expect(scopedRelationships("all", [shopEdge, unrelatedEdgeTouchingAnchor], [shopEdge])).toEqual([shopEdge, unrelatedEdgeTouchingAnchor]);
  });

  it("keeps Shop scope when navigating to a Shop table and expands otherwise", () => {
    const shopIds = new Set(["E", "PD"]);
    expect(preserveShopScope("shop", "PD", shopIds)).toBe("shop");
    expect(preserveShopScope("shop", "Z", shopIds)).toBe("all");
    expect(preserveShopScope("all", "E", shopIds)).toBe("all");
    expect(tableIdForShopScope("Z", shopIds, "E")).toBe("E");
    expect(tableIdForShopScope("PD", shopIds, "E")).toBe("PD");
  });

  it("keeps reporting-kit scope when navigating to a declared table", () => {
    const reportingIds = new Set(["E", "WD", "S"]);
    expect(preserveExplorerScope("reporting", "WD", reportingIds)).toBe("reporting");
    expect(preserveExplorerScope("reporting", "Z", reportingIds)).toBe("all");
  });

  it("normalizes schema fields without passing raw metadata to the client", () => {
    expect(normalizeExplorerFields([
      { id: "B", name: "Owner", type: "ref", referenceToTable: "LE", reverseField: "R" },
      { id: "A", name: "Status", type: "choice", choices: [{ id: "1", caption: "Active", secret: "omit" }] },
      { id: "C", name: "Broken", type: "ref" },
    ])).toEqual([
      { id: "C", name: "Broken", type: "ref", choices: [], referenceToTable: "Unknown", referenceFromTable: "Unknown", referenceFromField: "Unknown", reverseField: "Unknown", metadataState: "partial" },
      { id: "B", name: "Owner", type: "ref", choices: [], referenceToTable: "LE", referenceFromTable: "Unknown", referenceFromField: "Unknown", reverseField: "R", metadataState: "available" },
      { id: "A", name: "Status", type: "choice", choices: [{ id: "1", caption: "Active" }], referenceToTable: "Unknown", referenceFromTable: "Unknown", referenceFromField: "Unknown", reverseField: "Unknown", metadataState: "available" },
    ]);
  });
});
