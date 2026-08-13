import type { ExplorerRelationship } from "./explorer-data.js";

export interface GraphNode { id: string; name: string; label: string; x: number; y: number; isCenter: boolean }
export interface GraphModel { center: GraphNode; neighbors: GraphNode[]; edges: ExplorerRelationship[] }

export function graphNodeLabel(name: string, limit = 16): string {
  if (name.length <= limit) return name;
  return `${name.slice(0, Math.max(1, limit - 1))}…`;
}

export function relationshipGraph(selectedTableId: string, selectedTableName: string, edges: ExplorerRelationship[], width = 760, height = 560): GraphModel {
  const direct = edges.filter((edge) => edge.sourceTableId === selectedTableId || edge.targetTableId === selectedTableId);
  const byId = new Map<string, { id: string; name: string }>();
  for (const edge of direct) {
    const neighbor = edge.sourceTableId === selectedTableId
      ? { id: edge.targetTableId, name: edge.targetTable }
      : { id: edge.sourceTableId, name: edge.sourceTable };
    if (neighbor.id !== selectedTableId && !byId.has(neighbor.id)) byId.set(neighbor.id, neighbor);
  }
  const center = { id: selectedTableId, name: selectedTableName, label: graphNodeLabel(selectedTableName), x: width / 2, y: height / 2, isCenter: true };
  const sorted = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const innerCount = sorted.length > 12 ? Math.min(9, Math.ceil(sorted.length * 0.4)) : sorted.length;
  const neighbors = sorted.map((node, index) => {
    const outer = sorted.length > 12 && index >= innerCount;
    const ringIndex = outer ? index - innerCount : index;
    const ringCount = outer ? sorted.length - innerCount : innerCount;
    const angleOffset = outer ? Math.PI / Math.max(1, ringCount) : 0;
    const angle = -Math.PI / 2 + angleOffset + (ringIndex * Math.PI * 2) / Math.max(1, ringCount);
    const radius = outer ? Math.min(width * 0.4, height * 0.42) : Math.min(122, Math.min(width, height) * 0.3);
    return { ...node, label: graphNodeLabel(node.name), x: width / 2 + Math.cos(angle) * radius, y: height / 2 + Math.sin(angle) * radius, isCenter: false };
  });
  return { center, neighbors, edges: direct };
}
