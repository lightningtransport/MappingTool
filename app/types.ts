export interface ShopMapData {
  generatedAt: string;
  anchor: { tableId: string; tableName: string };
  nodes: { tableId: string; tableName: string; role: "anchor" | "related" }[];
  edges: {
    sourceTable: string;
    sourceTableId: string;
    sourceField: string;
    sourceFieldId: string;
    targetTable: string;
    targetTableId: string;
    targetField: string;
    reverseField: string;
    source: "ninox" | "detected" | "unknown";
    confidence: number;
  }[];
  hypotheses: unknown[];
  allTables: { tableId: string; tableName: string; relationshipCount: number }[];
}
