import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { declaredAnchorTableId, reconcileDeclaredCatalog } from "../src/catalog/declaredCatalog.js";
import type { NinoxTableSchema } from "../src/ninox/types.js";

const schema = [
  { id: "E", name: "TrucksDB", fields: [{ id: "A", name: "Truck #", type: "text" }, { id: "TA", name: "Mechanic", type: "text" }] },
  { id: "WD", name: "DriverPay", fields: [{ id: "O", name: "Out Date", type: "date" }] },
] as NinoxTableSchema[];

describe("declared reporting catalog", () => {
  it("reconciles committed kit mappings without inventing Ninox IDs", async () => {
    const raw = JSON.parse(await readFile(resolve(process.cwd(), "config/declared-catalog.json"), "utf8"));
    const declared = reconcileDeclaredCatalog(raw, schema);
    expect(declared.schemaVersion).toBe("3.2.0");
    expect(declared.kitPackageVersion).toBe("3.8.23");
    expect(declared.tableIds).toEqual(["E", "WD", "Z", "S", "DE"]);
    expect(declared.tables.find((table) => table.report === "fuel")?.presence).toBe("unknown-id");
    expect(declared.tables.find((table) => table.tableId === "E")?.presence).toBe("in-schema");
    expect(declared.tables.find((table) => table.tableId === "Z")?.presence).toBe("absent");
    expect(declared.tables.find((table) => table.tableId === "E")?.fields.find((field) => field.fieldId === "A")?.presence).toBe("in-schema");
    expect(declared.tables.find((table) => table.tableId === "WD")?.fields.find((field) => field.fieldId === "IA")).toMatchObject({ reportField: "Truck_Number", binding: "documented", presence: "absent" });
    expect(declared.tables.find((table) => table.tableId === "S")?.fields.find((field) => field.fieldId === "E3")?.binding).toBe("source-omission");
    expect(declared.repositories.find((repo) => repo.id === "ltl-shop")).toMatchObject({
      status: "repo-verified",
      reason: "Prisma was read at apps/api/prisma/schema.prisma on main @ 0f560c1; runtime supabase; zero Ninox table IDs.",
    });
    expect(declared.shopApp).toEqual({
      label: "Lightning Shop",
      defaultBranch: "main",
      verifiedCommit: "0f560c1cafd12463cf95e24904af4f5da821e68d",
      verifiedAt: "2026-09-19T23:30:00Z",
      runtimeDataSource: "supabase",
      vehicleKey: "truckNumber",
      ninoxTableIds: [],
      yardPhases: ["inspection", "shop_work", "alignment", "detailing", "quality_check", "ready_to_go"],
      workOrderStatuses: ["created", "in_progress", "waiting_paused", "completed", "cancelled"],
    });
    expect(declared.joinRules.some((rule) => rule.includes("fuel.Unit"))).toBe(true);
    expect(declaredAnchorTableId(declared)).toBe("E");
  });

  it("keeps repo-verified shop status and does not invent Ninox table IDs", async () => {
    const raw = JSON.parse(await readFile(resolve(process.cwd(), "config/declared-catalog.json"), "utf8"));
    const declared = reconcileDeclaredCatalog(raw, schema);
    expect(declared.shopApp?.ninoxTableIds).toEqual([]);
    expect(declared.notes.some((note) => note.includes("repo-verified") && note.includes("0f560c1cafd12463cf95e24904af4f5da821e68d"))).toBe(true);
    expect(reconcileDeclaredCatalog({
      repositories: [{ id: "ltl-shop", url: "https://example.test", role: "Shop", status: "invented" }],
    }).repositories[0]?.status).toBe("unavailable");
  });

  it("does not treat join rules as relationship identities", async () => {
    const raw = JSON.parse(await readFile(resolve(process.cwd(), "config/declared-catalog.json"), "utf8"));
    const declared = reconcileDeclaredCatalog(raw, schema);
    expect(declared.tables.every((table) => table.tableId === null || /^[A-Z0-9]+$/.test(table.tableId))).toBe(true);
    expect(JSON.stringify(declared.joinRules)).not.toMatch(/"sourceTableId"/);
  });
});
