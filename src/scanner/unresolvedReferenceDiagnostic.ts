import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ReadOnlyNinoxClient } from "../ninox/client.js";
import { sanitizeError } from "../ninox/sanitize.js";
import type { NinoxDatabaseSchema, NinoxTableSchema, UnknownObject } from "../ninox/types.js";

export type TargetAssessment = "catalogued" | "accessible-not-catalogued" | "unresolved";

export interface ReferenceFieldEvidence {
  tableId: string;
  tableName: string;
  fieldId: string;
  fieldName: string;
  type: "ref" | "rev";
  referenceToTable: string;
  referenceFromTable: string;
  referenceFromField: string;
  reverseField: string;
}

export interface TableEntryEvidence {
  tableId: string;
  tableName: string;
  fieldCount: number | null;
  keys: string[];
}

export interface UnresolvedReferenceDiagnostic {
  generatedAt: string;
  targetTableId: string;
  assessment: TargetAssessment;
  databaseSchema: {
    databaseId: string;
    databaseName: string;
    responseShape: "object" | "array" | "other";
    tableContainer: "tables-array" | "schema-types-map" | "unavailable";
    embeddedTableCount: number | null;
    targetPresent: boolean | null;
    targetEntry: TableEntryEvidence | null;
    rootKeys: string[];
    settingsKeys: string[];
    schemaKeys: string[];
  };
  catalog: {
    tableCount: number;
    targetPresent: boolean;
    targetEntry: TableEntryEvidence | null;
  };
  targetProbe: {
    status: "available" | "unavailable";
    table: TableEntryEvidence | null;
    error: string | null;
  };
  forwardReferences: ReferenceFieldEvidence[];
  reverseReferences: ReferenceFieldEvidence[];
  inspectionErrors: { tableId: string; message: string }[];
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Unknown";
}

function asObject(value: unknown): UnknownObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownObject
    : null;
}

function objects(value: unknown): UnknownObject[] {
  return Array.isArray(value)
    ? value.map(asObject).filter((item): item is UnknownObject => item !== null)
    : [];
}

function matchingTable(value: unknown, targetTableId: string): UnknownObject | null {
  return objects(value).find((table) => text(table.id) === targetTableId) ?? null;
}

function tableEntryEvidence(tableId: string, value: unknown): TableEntryEvidence | null {
  const table = asObject(value);
  if (!table) return null;
  return {
    tableId,
    tableName: text(table.name ?? table.caption),
    fieldCount: Array.isArray(table.fields) ? table.fields.length : null,
    keys: Object.keys(table).sort(),
  };
}

function databaseTableEvidence(databaseSchema: NinoxDatabaseSchema, targetTableId: string): {
  container: "tables-array" | "schema-types-map" | "unavailable";
  count: number | null;
  targetPresent: boolean | null;
  targetEntry: TableEntryEvidence | null;
} {
  if (Array.isArray(databaseSchema.tables)) {
    const targetEntry = matchingTable(databaseSchema.tables, targetTableId);
    return {
      container: "tables-array",
      count: databaseSchema.tables.length,
      targetPresent: targetEntry !== null,
      targetEntry: tableEntryEvidence(targetTableId, targetEntry),
    };
  }
  const schema = asObject(databaseSchema.schema);
  const types = asObject(schema?.types);
  if (types) {
    const targetPresent = Object.prototype.hasOwnProperty.call(types, targetTableId);
    return {
      container: "schema-types-map",
      count: Object.keys(types).length,
      targetPresent,
      targetEntry: targetPresent ? tableEntryEvidence(targetTableId, types[targetTableId]) : null,
    };
  }
  return { container: "unavailable", count: null, targetPresent: null, targetEntry: null };
}

async function inspectCatalog(
  client: ReadOnlyNinoxClient,
  catalog: NinoxTableSchema[],
  concurrency: number,
): Promise<{
  tables: NinoxTableSchema[];
  errors: { tableId: string; message: string }[];
  availableTableIds: Set<string>;
}> {
  const tables: NinoxTableSchema[] = new Array(catalog.length);
  const errors: { tableId: string; message: string }[] = [];
  const availableTableIds = new Set<string>();
  let cursor = 0;
  async function consume(): Promise<void> {
    while (cursor < catalog.length) {
      const index = cursor++;
      const fallback = catalog[index] as NinoxTableSchema;
      const tableId = text(fallback.id);
      try {
        tables[index] = await client.getTable(tableId);
        availableTableIds.add(tableId);
      } catch (error) {
        tables[index] = fallback;
        errors.push({ tableId, message: sanitizeError(error).message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, catalog.length) }, () => consume()));
  return { tables, errors, availableTableIds };
}

function collectFieldEvidence(
  tables: NinoxTableSchema[],
  predicate: (field: UnknownObject) => boolean,
): ReferenceFieldEvidence[] {
  return tables.flatMap((table) => objects(table.fields)
    .filter(predicate)
    .map((field) => ({
      tableId: text(table.id),
      tableName: text(table.name),
      fieldId: text(field.id),
      fieldName: text(field.name),
      type: field.type === "rev" ? "rev" : "ref",
      referenceToTable: text(field.referenceToTable),
      referenceFromTable: text(field.referenceFromTable),
      referenceFromField: text(field.referenceFromField),
      reverseField: text(field.reverseField),
    })));
}

export async function diagnoseUnresolvedReference(
  client: ReadOnlyNinoxClient,
  targetTableId: string,
  concurrency = 5,
): Promise<UnresolvedReferenceDiagnostic> {
  const normalizedTarget = targetTableId.trim();
  if (!normalizedTarget) throw new Error("Target table ID cannot be empty");
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) throw new Error("Concurrency must be positive");

  const [databaseSchema, catalog] = await Promise.all([
    client.getDatabaseSchema(),
    client.getTables(),
  ]);
  const inspected = await inspectCatalog(client, catalog, concurrency);
  const catalogTarget = catalog.find((table) => text(table.id) === normalizedTarget) ?? null;
  const inspectedTarget = inspected.tables.find((table) => text(table.id) === normalizedTarget) ?? null;
  let targetTable = inspected.availableTableIds.has(normalizedTarget) ? inspectedTarget : null;
  let targetError = inspected.errors.find((error) => error.tableId === normalizedTarget)?.message ?? null;

  if (!catalogTarget) {
    try {
      targetTable = await client.getTable(normalizedTarget);
    } catch (error) {
      targetError = sanitizeError(error).message;
    }
  }

  const databaseTables = databaseTableEvidence(databaseSchema, normalizedTarget);
  const databaseSchemaObject = asObject(databaseSchema);
  const settingsObject = asObject(databaseSchemaObject?.settings);
  const schemaObject = asObject(databaseSchemaObject?.schema);
  const forwardReferences = collectFieldEvidence(
    inspected.tables,
    (field) => field.type === "ref" && text(field.referenceToTable) === normalizedTarget,
  );
  const reverseReferences = collectFieldEvidence(
    inspected.tables,
    (field) => field.type === "rev" && text(field.referenceFromTable) === normalizedTarget,
  );

  return {
    generatedAt: new Date().toISOString(),
    targetTableId: normalizedTarget,
    assessment: catalogTarget ? "catalogued" : targetTable ? "accessible-not-catalogued" : "unresolved",
    databaseSchema: {
      databaseId: text(databaseSchema.id),
      databaseName: text(databaseSchema.name),
      responseShape: Array.isArray(databaseSchema) ? "array" : asObject(databaseSchema) ? "object" : "other",
      tableContainer: databaseTables.container,
      embeddedTableCount: databaseTables.count,
      targetPresent: databaseTables.targetPresent,
      targetEntry: databaseTables.targetEntry,
      rootKeys: databaseSchemaObject ? Object.keys(databaseSchemaObject).sort() : [],
      settingsKeys: settingsObject ? Object.keys(settingsObject).sort() : [],
      schemaKeys: schemaObject ? Object.keys(schemaObject).sort() : [],
    },
    catalog: {
      tableCount: catalog.length,
      targetPresent: catalogTarget !== null,
      targetEntry: catalogTarget ? tableEntryEvidence(normalizedTarget, catalogTarget) : null,
    },
    targetProbe: {
      status: targetTable ? "available" : "unavailable",
      table: targetTable ? tableEntryEvidence(normalizedTarget, targetTable) : null,
      error: targetTable ? null : targetError,
    },
    forwardReferences,
    reverseReferences,
    inspectionErrors: inspected.errors,
  };
}

export async function writeUnresolvedReferenceDiagnostic(
  diagnostic: UnresolvedReferenceDiagnostic,
  outputRoot = resolve(process.cwd(), "output"),
): Promise<string> {
  const safeTarget = diagnostic.targetTableId.replace(/[^a-zA-Z0-9_-]+/g, "-") || "Unknown";
  const analysisRoot = resolve(outputRoot, "analysis");
  const outputPath = resolve(analysisRoot, `unresolved-${safeTarget}.json`);
  await mkdir(analysisRoot, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(diagnostic, null, 2)}\n`, "utf8");
  return outputPath;
}
