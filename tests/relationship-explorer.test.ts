import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RelationshipExplorer from "../app/relationship-explorer.js";
import type { ExplorerData } from "../app/explorer-data.js";

const relationship = {
  sourceTable: "TrucksDB",
  sourceTableId: "A",
  sourceField: "Owner",
  sourceFieldId: "f1",
  targetTable: "Owner",
  targetTableId: "B",
  targetField: "Id",
  reverseField: "Trucks",
  source: "ninox" as const,
  confidence: 1,
  provenance: "ninox" as const,
  raw: {},
};

const data: ExplorerData = {
  generatedAt: "2026-08-13T00:00:00.000Z",
  tables: [
    { id: "A", name: "TrucksDB", relationshipCount: 1, fields: [] },
    { id: "B", name: "Owner", relationshipCount: 1, fields: [] },
  ],
  relationships: [relationship],
  shopMap: {
    generatedAt: "2026-08-13T00:00:00.000Z",
    anchor: { tableId: "A", tableName: "TrucksDB" },
    nodes: [
      { tableId: "A", tableName: "TrucksDB", role: "anchor" },
      { tableId: "B", tableName: "Owner", role: "related" },
    ],
    edges: [relationship],
    hypotheses: [],
    allTables: [
      { tableId: "A", tableName: "TrucksDB", relationshipCount: 1 },
      { tableId: "B", tableName: "Owner", relationshipCount: 1 },
    ],
  },
  summary: { tableCount: 2, relationshipCount: 1, fieldCount: 2, sampledRecords: 0 },
  quality: {
    generatedAt: "2026-08-13T00:00:00.000Z",
    scanScannedAt: "2026-08-13T00:00:00.000Z",
    tables: { total: 2, connected: 2, isolated: 0, hypothesisOnly: 0 },
    relationships: { confirmed: 1, detected: 0, unknown: 0 },
    isolatedTables: [],
    hypothesisOnlyTables: [],
    inferredRelationships: [],
    unresolvedReferences: [],
    scanErrors: [],
  },
  history: [],
};

describe("relationship explorer SSR", () => {
  it("renders SVG titles as stable text for hydration", () => {
    const html = renderToString(createElement(RelationshipExplorer, { data }));

    expect(html).toContain('<title id="graph-title">Relationships centered on TrucksDB</title>');
    expect(html).toContain("<title>Ninox: TrucksDB.Owner to Owner.Id</title>");
    expect(html).not.toMatch(/<title[^>]*><\/title>/);
  });

  it("renders the selected table field inspector", () => {
    const html = renderToString(createElement(RelationshipExplorer, { data: {
      ...data,
      tables: [{ ...data.tables[0]!, fields: [{ id: "f1", name: "Owner", type: "ref", choices: [], referenceToTable: "B", referenceFromTable: "Unknown", referenceFromField: "Unknown", reverseField: "Trucks", metadataState: "available" }] }, data.tables[1]!],
    } }));
    expect(html).toContain("Field inspector");
    expect(html).toContain("Owner");
    expect(html).toContain("REFERENCE TO");
    expect(html).toContain("Owner<!-- --> <small>(<!-- -->B<!-- -->)</small>");
  });

  it("labels a broken Ninox target as unresolved rather than inferred", () => {
    const unresolved = {
      ...relationship,
      targetTable: "Unknown",
      targetTableId: "UC",
      source: "unknown" as const,
      confidence: 0,
      provenance: "unresolved Ninox ref",
    };
    const unresolvedData: ExplorerData = {
      ...data,
      relationships: [unresolved],
      shopMap: { ...data.shopMap, edges: [unresolved] },
      quality: {
        ...data.quality,
        relationships: { confirmed: 0, detected: 0, unknown: 1 },
        unresolvedReferences: [{
          sourceTable: unresolved.sourceTable,
          sourceTableId: unresolved.sourceTableId,
          sourceField: unresolved.sourceField,
          sourceFieldId: unresolved.sourceFieldId,
          targetTableId: unresolved.targetTableId,
          reason: "target-not-in-schema",
        }],
      },
    };

    const html = renderToString(createElement(RelationshipExplorer, { data: unresolvedData }));
    expect(html).toContain("Review unresolved references");
    expect(html).toContain("unresolved table <!-- -->UC");
    expect(html).toContain("Broken Ninox reference");
    expect(html).not.toContain("Hypothesis ·");
  });

  it("renders the latest structural change summary", () => {
    const historyData: ExplorerData = {
      ...data,
      history: [{
        baseline: false,
        fromScannedAt: "2026-08-14T00:00:00.000Z",
        toScannedAt: "2026-08-14T01:00:00.000Z",
        summary: { total: 3, tablesAdded: 1, tablesRemoved: 0, tablesRenamed: 0, fieldsAdded: 1, fieldsRemoved: 0, fieldsRenamed: 0, fieldsChanged: 0, relationshipsAdded: 1, relationshipsRemoved: 0, relationshipsChanged: 0 },
        highlights: ["Table added: New (C)", "Field added: New.Field (F)", "Relationship added: A.F → C"],
        remainingChanges: 0,
      }],
    };

    const html = renderToString(createElement(RelationshipExplorer, { data: historyData }));
    expect(html).toContain("3 structural changes in the latest scan.");
    expect(html).toContain("1</b> scans");
    expect(html).toContain("3</b> latest changes");
    expect(html).toContain("3 CHANGES");
    expect(html).toContain("Table added: New (C)");
  });

  it("keeps an earlier changed scan visible when the latest scan has no changes", () => {
    const changed = {
      baseline: false,
      fromScannedAt: "2026-08-14T00:00:00.000Z",
      toScannedAt: "2026-08-14T01:00:00.000Z",
      summary: { total: 1, tablesAdded: 0, tablesRemoved: 0, tablesRenamed: 0, fieldsAdded: 1, fieldsRemoved: 0, fieldsRenamed: 0, fieldsChanged: 0, relationshipsAdded: 0, relationshipsRemoved: 0, relationshipsChanged: 0 },
      highlights: ["Field added: Alpha.New field (F)"],
      remainingChanges: 0,
    };
    const html = renderToString(createElement(RelationshipExplorer, { data: {
      ...data,
      history: [{ ...changed, fromScannedAt: changed.toScannedAt, toScannedAt: "2026-08-14T02:00:00.000Z", summary: { ...changed.summary, total: 0, fieldsAdded: 0 }, highlights: [] }, changed],
    } }));
    expect(html).toContain("Latest scan found no new structural changes. Earlier comparisons remain below.");
    expect(html).toContain("Field added: Alpha.New field (F)");
    expect(html).toContain("1 CHANGE");
  });
});
