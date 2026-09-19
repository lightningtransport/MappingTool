import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NinoxTableSchema } from "../ninox/types.js";
import { emptyDeclaredCatalog, reconcileDeclaredCatalog, type DeclaredCatalogView } from "./declaredCatalog.js";

export const DECLARED_CATALOG_PATH = resolve(process.cwd(), "config", "declared-catalog.json");

export async function readDeclaredCatalog(
  schema: NinoxTableSchema[] = [],
  path = DECLARED_CATALOG_PATH,
): Promise<DeclaredCatalogView> {
  try {
    return reconcileDeclaredCatalog(JSON.parse(await readFile(path, "utf8")), schema);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return emptyDeclaredCatalog("config/declared-catalog.json is missing");
    return emptyDeclaredCatalog("Declared catalog config could not be read");
  }
}
