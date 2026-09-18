import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { searchCatalog, type ExplorerData } from "../app/explorer-data.js";
import { catalogMarkdown, writeCatalogExports } from "../src/catalog/exportCatalog.js";
import { buildReportingKitCandidates, mergeImportCandidates, type ReportingKitMetadata } from "../src/catalog/importReportingKit.js";
import { catalogCoverage, findCatalogOrphans } from "../src/catalog/model.js";
import { decideCandidate, defaultFieldReview, defaultRelationshipReview, defaultTableReview } from "../src/catalog/review.js";
import { emptyCatalog, migrateCatalogAnnotations, mutateCatalog, readCatalog } from "../src/catalog/store.js";
import { humanProvenance } from "../src/catalog/types.js";
import type { NinoxTableSchema } from "../src/ninox/types.js";

const schema = [{ id: "E", name: "TrucksDB", fields: [{ id: "A", name: "Truck #", type: "text" }] }] as NinoxTableSchema[];
const metadata: ReportingKitMetadata = {
  schemaVersion: "3.2.1",
  schemaVerifiedAt: "2026-09-01",
  globalGuidance: { join_rules: ["Join by explicit IDs"], freshness: "Nightly snapshot" },
  tables: {
    trucks: {
      ninox_source: "TrucksDB (E)", row_grain: "One row per truck", use_for: ["Fleet identity"], do_not_use_for: ["Live GPS"],
      calculation_rules: ["Use governed status"], fields: {
        truck_number: { ninox_field: "E.A", meaning: "Canonical truck number" },
        guessed: { ninox_field: "Truck Number", meaning: "Must not import" },
      },
    },
    fuzzy_only: { ninox_source: "TrucksDB", row_grain: "No explicit ID", fields: {} },
  },
};

describe("catalog persistence", () => {
  it("migrates a legacy file and rejects unsupported versions", () => {
    const migrated = migrateCatalogAnnotations({ tables: { E: { description: "Fleet master" } } }, "2026-01-01T00:00:00.000Z");
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.tables.E?.status).toBe("unknown");
    expect(() => migrateCatalogAnnotations({ schemaVersion: 99 })).toThrow("Unsupported catalog schema version");
  });

  it("reports corrupt JSON without overwriting it", async () => {
    const root = await mkdtemp(join(tmpdir(), "ninox-catalog-corrupt-"));
    await writeFile(join(root, "annotations.json"), "not-json", "utf8");
    const loaded = await readCatalog(root);
    expect(loaded.issue).toContain("could not be loaded");
    await expect(mutateCatalog((catalog) => catalog, root)).rejects.toThrow("could not be loaded");
    expect(await readFile(join(root, "annotations.json"), "utf8")).toBe("not-json");
  });

  it("serializes concurrent atomic mutations without losing changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "ninox-catalog-concurrent-"));
    await Promise.all([
      mutateCatalog((catalog) => { catalog.tables.E = defaultTableReview("E"); return catalog; }, root),
      mutateCatalog((catalog) => { catalog.fields["E:A"] = defaultFieldReview("E", "A"); return catalog; }, root),
    ]);
    const loaded = await readCatalog(root);
    expect(loaded.issue).toBeNull();
    expect(Object.keys(loaded.catalog.tables)).toEqual(["E"]);
    expect(Object.keys(loaded.catalog.fields)).toEqual(["E:A"]);
  });
});

describe("external candidate import", () => {
  it("imports explicit Ninox IDs only and records version/hash provenance", () => {
    const built = buildReportingKitCandidates(metadata, schema, "source-file-hash", "2026-09-18T00:00:00.000Z");
    expect(built.candidates.map((candidate) => candidate.kind)).toEqual(["table", "field", "consumer"]);
    expect(built.candidates.some((candidate) => candidate.fieldId === "A")).toBe(true);
    expect(built.candidates.some((candidate) => candidate.payload.field?.description === "Must not import")).toBe(false);
    expect(built.ignoredMappings).toContain("fuzzy_only: missing or unavailable explicit Ninox table ID");
    expect(built.candidates[0]?.provenance.sourceVersion).toBe("3.2.1");
    expect(built.candidates[0]?.provenance.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps decisions for identical candidates and reopens changed source content", () => {
    const catalog = emptyCatalog();
    const first = buildReportingKitCandidates(metadata, schema, "hash-1", "2026-09-18T00:00:00.000Z").candidates;
    mergeImportCandidates(catalog, first);
    const candidateId = first[0]!.id;
    decideCandidate(catalog, candidateId, "rejected", "", "2026-09-18T01:00:00.000Z");
    mergeImportCandidates(catalog, buildReportingKitCandidates(metadata, schema, "hash-1", "2026-09-18T02:00:00.000Z").candidates);
    expect(catalog.candidates[candidateId]?.decision).toBe("rejected");
    mergeImportCandidates(catalog, buildReportingKitCandidates(metadata, schema, "hash-2", "2026-09-18T03:00:00.000Z").candidates);
    expect(catalog.candidates[candidateId]?.decision).toBe("pending");
  });

  it("accepts proposals only into blank knowledge and preserves human text", () => {
    const catalog = emptyCatalog();
    catalog.tables.E = { ...defaultTableReview("E"), description: "Human description", provenance: humanProvenance() };
    const candidate = buildReportingKitCandidates(metadata, schema, "hash", "2026-09-18T00:00:00.000Z").candidates[0]!;
    catalog.candidates[candidate.id] = candidate;
    decideCandidate(catalog, candidate.id, "accepted");
    expect(catalog.tables.E?.description).toBe("Human description");
    expect(catalog.tables.E?.grain).toBe("One row per truck");
  });
});

describe("catalog reconciliation, search, and export", () => {
  it("preserves and surfaces orphan annotations after a rescan", () => {
    const catalog = emptyCatalog();
    catalog.tables.GONE = defaultTableReview("GONE");
    catalog.fields["E:MISSING"] = defaultFieldReview("E", "MISSING");
    catalog.relationships["E:A:GONE"] = defaultRelationshipReview("E", "A", "GONE");
    const orphans = findCatalogOrphans(catalog, schema, []);
    expect(orphans.map((orphan) => orphan.kind)).toEqual(["table", "field", "relationship"]);
    expect(catalogCoverage(catalog, orphans).orphanedAnnotations).toBe(3);
  });

  it("searches IDs, human meaning, safe use, and consumers", () => {
    const catalog = emptyCatalog();
    catalog.tables.E = { ...defaultTableReview("E"), description: "Authoritative fleet asset master", tags: ["fleet"] };
    catalog.fields["E:A"] = { ...defaultFieldReview("E", "A"), description: "Canonical unit identifier", safeUse: "Join settlements by normalized truck number" };
    catalog.consumers.dashboard = { id: "dashboard", name: "Operations dashboard", kind: "app", purpose: "Monitors fleet", tableIds: ["E"], fieldKeys: ["E:A"], filters: ["active only"], joins: [], freshnessLimitations: [], provenance: humanProvenance(), updatedAt: "2026-09-18" };
    const data = { tables: [{ id: "E", name: "TrucksDB", relationshipCount: 0, fields: [{ id: "A", name: "Truck #", type: "text", choices: [], referenceToTable: "Unknown", referenceFromTable: "Unknown", referenceFromField: "Unknown", reverseField: "Unknown", metadataState: "available" }] }], catalog: { annotations: catalog } } as unknown as ExplorerData;
    expect(searchCatalog(data, "normalized")[0]?.kind).toBe("field");
    expect(searchCatalog(data, "operations dashboard")[0]?.kind).toBe("consumer");
    expect(searchCatalog(data, "E").length).toBeGreaterThan(0);
  });

  it("exports reviewed knowledge without candidates or record samples", async () => {
    const root = await mkdtemp(join(tmpdir(), "ninox-catalog-export-"));
    const catalog = emptyCatalog();
    catalog.tables.E = { ...defaultTableReview("E"), description: "Fleet table" };
    const candidate = buildReportingKitCandidates(metadata, schema, "hash").candidates[0]!;
    candidate.payload.table = { description: "PRIVATE_SAMPLE_VALUE" };
    catalog.candidates[candidate.id] = candidate;
    const paths = await writeCatalogExports(catalog, root);
    const json = await readFile(paths.jsonPath, "utf8");
    const markdown = await readFile(paths.markdownPath, "utf8");
    expect(json).not.toContain("PRIVATE_SAMPLE_VALUE");
    expect(markdown).not.toContain("PRIVATE_SAMPLE_VALUE");
    expect(catalogMarkdown(catalog)).toContain("Fleet table");
  });
});
