import { describe, expect, it } from "vitest";
import { graphNodeLabel, relationshipGraph } from "../app/relationship-graph-model.js";
import type { ExplorerRelationship } from "../app/explorer-data.js";

const edge = (sourceTableId: string, sourceTable: string, targetTableId: string, targetTable: string, source = "ninox") => ({ sourceTableId, sourceTable, sourceFieldId: "f", targetTableId, targetTable, sourceField: "field", targetField: "target", reverseField: "reverse", source, provenance: source, confidence: 1, raw: {} } as ExplorerRelationship);
describe("relationship graph model", () => {
  it("keeps only direct neighbors and visible parallel edges", () => { const graph = relationshipGraph("A", "A", [edge("A", "A", "B", "B"), edge("A", "A", "B", "B", "detected"), edge("B", "B", "C", "C")]); expect(graph.neighbors.map((n) => n.id)).toEqual(["B"]); expect(graph.edges).toHaveLength(2); });
  it("deduplicates neighbors and positions deterministically", () => { const edges = [edge("A", "A", "C", "C"), edge("B", "B", "A", "A"), edge("A", "A", "D", "D")]; const one = relationshipGraph("A", "A", edges); expect(one.neighbors.map((n) => n.id)).toEqual(["B", "C", "D"]); expect(one).toEqual(relationshipGraph("A", "A", edges)); });
  it("supports empty graphs", () => { const graph = relationshipGraph("A", "A", [edge("B", "B", "C", "C")]); expect(graph.neighbors).toEqual([]); expect(graph.edges).toEqual([]); });
  it("uses two non-overlapping rings for dense direct neighborhoods", () => {
    const edges = Array.from({ length: 24 }, (_, index) => edge("A", "A", `N${index.toString().padStart(2, "0")}`, `Neighbor ${index}`));
    const graph = relationshipGraph("A", "A", edges);
    const radii = graph.neighbors.map((node) => Math.round(Math.hypot(node.x - graph.center.x, node.y - graph.center.y)));
    expect(new Set(radii).size).toBe(2);
    expect(new Set(graph.neighbors.map((node) => `${node.x.toFixed(3)}:${node.y.toFixed(3)}`)).size).toBe(24);
  });
  it("shortens only the visual label", () => {
    expect(graphNodeLabel("Body_Shop_Parts_Record")).toBe("Body_Shop_Parts…");
    expect(graphNodeLabel("TrucksDB")).toBe("TrucksDB");
  });
});
