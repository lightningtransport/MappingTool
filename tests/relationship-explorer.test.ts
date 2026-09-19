import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RelationshipExplorer from "../app/relationship-explorer.js";
import type { ExplorerData } from "../app/explorer-data.js";
import { emptyCatalog } from "../src/catalog/store.js";
import { emptyDeclaredCatalog, reconcileDeclaredCatalog } from "../src/catalog/declaredCatalog.js";

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
  catalog: {
    annotations: emptyCatalog("2026-08-13T00:00:00.000Z"),
    coverage: { reviewedTables: 0, documentedFields: 0, pendingCandidates: 0, pendingRelationships: 0, orphanedAnnotations: 0 },
    orphans: [],
    issue: null,
  },
  declared: emptyDeclaredCatalog(),
};

describe("relationship explorer SSR", () => {
  it("renders the catalog identity and evidence boundaries", () => {
    const html = renderToString(createElement(RelationshipExplorer, { data }));

    expect(html).toContain("TECHNICAL CATALOG");
    expect(html).toContain("Ninox evidence");
    expect(html).toContain("Human reviewed");
    expect(html).toContain("Usage &amp; Review");
    expect(html).toContain("READ ONLY TO NINOX");
    expect(html).toContain("Reporting kit");
  });

  it("renders declared reporting mappings as external notes, not Ninox edges", () => {
    const declared = reconcileDeclaredCatalog({
      source: { label: "Lightning Transportation Data Reporting Kit", schemaVersion: "3.2.0" },
      repositories: [{ id: "ltl-shop", url: "https://github.com/lightningtransport/LTL_Shop", role: "Shop app", status: "unavailable", reason: "GitHub 404" }],
      tables: [{ report: "trucks", ninoxName: "TrucksDB", tableId: "A", grain: "One truck", fields: [] }],
      joinRules: ["Use a LEFT JOIN from history to current trucks."],
      notes: ["DriverPay.Truck_Number is documented as Ninox WD.IA without ninox_field."],
    }, [{ id: "A", name: "Fleet trucks", fields: [] }]);
    const html = renderToString(createElement(RelationshipExplorer, { data: { ...data, declared } }));
    expect(html).toContain("Declared reporting catalog");
    expect(html).toContain("Declared reporting catalog · schema");
    expect(html).toContain("3.2.0");
    expect(html).toContain("Use a LEFT JOIN from history to current trucks.");
    expect(html).toContain("GitHub 404");
    expect(html).toContain("These are not Ninox ref/rev edges.");
    expect(html).toContain("Reporting-kit mappings for this table");
    expect(html).toContain("One truck");
    expect(html).toContain("Business-key join rules stay documented");
    expect(html).toContain("DriverPay.Truck_Number is documented as Ninox WD.IA without ninox_field.");
    expect(html).toContain("scan name Fleet trucks");
  });

  it("renders a stable overview editor for the selected table", () => {
    const html = renderToString(createElement(RelationshipExplorer, { data: {
      ...data,
      tables: [{ ...data.tables[0]!, fields: [{ id: "f1", name: "Owner", type: "ref", choices: [], referenceToTable: "B", referenceFromTable: "Unknown", referenceFromField: "Unknown", reverseField: "Trucks", metadataState: "available" }] }, data.tables[1]!],
    } }));
    expect(html).toContain("Meaning and governance");
    expect(html).toContain("Row grain");
    expect(html).toContain("Business key field IDs");
    expect(html).toContain("f1");
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
    expect(html).toContain("Unresolved <b>1</b>");
    expect(html).toContain("Structural evidence and scan history");
    expect(html).toContain("MAP QUALITY");
    expect(html).toContain("UNRESOLVED REFERENCES");
    expect(html).toContain("Broken Ninox reference");
  });

  it("renders empty and load-failure states without inventing tables", () => {
    const html = renderToString(createElement(RelationshipExplorer, { data: {
      ...data,
      tables: [],
      relationships: [],
      summary: { tableCount: 0, relationshipCount: 0, fieldCount: 0, sampledRecords: 0 },
      quality: { ...data.quality, tables: { total: 0, connected: 0, isolated: 0, hypothesisOnly: 0 }, unresolvedReferences: [] },
      loadIssue: "Local scan artifacts need attention: output/schema.json is missing. Run npm run scan or Rescan after configuring .env.local.",
    } }));
    expect(html).toContain("Scan artifacts need attention.");
    expect(html).toContain("output/schema.json is missing");
    expect(html).toContain("No tables loaded.");
    expect(html).not.toContain("TrucksDB</b>");
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
    expect(html).toContain("Saved scans <b>1</b>");
    expect(html).toContain("3 structural changes");
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
    expect(html).toContain("Saved scans <b>2</b>");
    expect(html).toContain("0 structural changes");
    expect(html).toContain("1 structural changes");
  });
});
