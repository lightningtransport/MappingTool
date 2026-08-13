import { describe, expect, it } from "vitest";
import { filterRelationships, relationshipCounts, scopedRelationships, type ExplorerRelationship } from "../app/explorer-data.js";

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

  it("uses only the exact Shop map edge set in Shop scope", () => {
    const shopEdge = edges[0]!;
    const unrelatedEdgeTouchingAnchor = { sourceTableId: "E", targetTableId: "C", source: "unknown" } as ExplorerRelationship;
    expect(scopedRelationships("shop", [shopEdge, unrelatedEdgeTouchingAnchor], [shopEdge])).toEqual([shopEdge]);
    expect(scopedRelationships("all", [shopEdge, unrelatedEdgeTouchingAnchor], [shopEdge])).toEqual([shopEdge, unrelatedEdgeTouchingAnchor]);
  });
});
