import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ReadOnlyNinoxClient } from "../src/ninox/client.js";
import { diagnoseUnresolvedReference, writeUnresolvedReferenceDiagnostic } from "../src/scanner/unresolvedReferenceDiagnostic.js";

function client(overrides: Partial<ReadOnlyNinoxClient> = {}): ReadOnlyNinoxClient {
  const tables = [
    { id: "V", name: "Repairs_Record" },
    { id: "BI", name: "Trailers_Repair_" },
  ];
  return {
    getDatabaseSchema: vi.fn(async () => ({ schema: { globalCode: "Bearer schema-secret-value", types: { V: { caption: "Repairs_Record" }, BI: { caption: "Trailers_Repair_" } } } })),
    getTables: vi.fn(async () => tables),
    getTable: vi.fn(async (tableId: string) => {
      if (tableId === "V") return { ...tables[0], fields: [{ id: "J4", name: "Trailers", type: "ref", referenceToTable: "UC" }] };
      if (tableId === "BI") return { ...tables[1], fields: [{ id: "R", name: "Old trailers", type: "rev", referenceFromTable: "UC", referenceFromField: "A" }] };
      throw new Error("Bearer secret-value");
    }),
    getSampleRecords: vi.fn(async () => []),
    ...overrides,
  };
}

describe("unresolved reference diagnostic", () => {
  it("keeps an unavailable non-catalogued target unresolved and sanitizes its probe error", async () => {
    const diagnostic = await diagnoseUnresolvedReference(client(), "UC", 2);

    expect(diagnostic).toMatchObject({
      targetTableId: "UC",
      assessment: "unresolved",
      databaseSchema: { responseShape: "object", tableContainer: "schema-types-map", targetPresent: false, embeddedTableCount: 2 },
      catalog: { targetPresent: false, tableCount: 2 },
      targetProbe: { status: "unavailable", table: null, error: "Unexpected Ninox client error" },
    });
    expect(diagnostic.forwardReferences).toHaveLength(1);
    expect(diagnostic.forwardReferences[0]).toMatchObject({ tableId: "V", fieldId: "J4", fieldName: "Trailers", type: "ref", referenceToTable: "UC" });
    expect(diagnostic.reverseReferences).toHaveLength(1);
    expect(diagnostic.reverseReferences[0]).toMatchObject({ tableId: "BI", fieldId: "R" });
    expect(JSON.stringify(diagnostic)).not.toContain("secret-value");
    expect(JSON.stringify(diagnostic)).not.toContain("schema-secret-value");
  });

  it("distinguishes a target that answers GET but is absent from the catalog", async () => {
    const base = client();
    const getTable = vi.fn(async (tableId: string) => tableId === "UC"
      ? { id: "UC", name: "Trailers", fields: [] }
      : base.getTable(tableId));
    const diagnostic = await diagnoseUnresolvedReference(client({ getTable }), "UC");

    expect(diagnostic).toMatchObject({
      assessment: "accessible-not-catalogued",
      targetProbe: { status: "available", table: { tableId: "UC", tableName: "Trailers", fieldCount: 0 }, error: null },
    });
  });

  it("does not report a catalog fallback as a successful metadata GET", async () => {
    const catalogued = { id: "UC", name: "Catalog label" };
    const diagnostic = await diagnoseUnresolvedReference(client({
      getDatabaseSchema: vi.fn(async () => ({ id: "DB", tables: [catalogued] })),
      getTables: vi.fn(async () => [catalogued]),
      getTable: vi.fn(async () => { throw new Error("metadata unavailable"); }),
    }), "UC");

    expect(diagnostic).toMatchObject({
      assessment: "catalogued",
      databaseSchema: { tableContainer: "tables-array", targetPresent: true },
      catalog: { targetPresent: true },
      targetProbe: { status: "unavailable", table: null },
    });
  });

  it("writes a target-scoped JSON artifact", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "ninox-unresolved-"));
    const diagnostic = await diagnoseUnresolvedReference(client(), "UC");
    const outputPath = await writeUnresolvedReferenceDiagnostic(diagnostic, outputRoot);

    expect(outputPath).toBe(join(outputRoot, "analysis", "unresolved-UC.json"));
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(diagnostic);
  });
});
