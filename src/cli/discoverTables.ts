import { getNinoxConfig, loadEnvironment } from "../config/env.js";
import { AxiosReadOnlyNinoxClient } from "../ninox/client.js";
import { discoverTables, writeSchemaOutput } from "../scanner/discoverTables.js";
import { sanitizeError } from "../ninox/sanitize.js";

loadEnvironment();

console.log("NINOX DATA MAPPER\n");
console.log("Discovering tables...");

try {
  const config = getNinoxConfig();
  const result = await discoverTables(new AxiosReadOnlyNinoxClient(config));
  const outputPath = await writeSchemaOutput(result);

  console.log(`✓ ${result.tableCount} tables discovered`);
  for (const table of result.tables) {
    const id = typeof table.id === "string" ? table.id : "Unknown";
    const name = typeof table.name === "string" ? table.name : "Unknown";
    console.log(`${name}\t${id}`);
  }
  console.log(`\nSchema saved to ${outputPath}`);
  console.log("READ ONLY — No Ninox data modified.");
} catch (error) {
  const safe = sanitizeError(error);
  console.error(`✗ ${safe.message}`);
  process.exitCode = 1;
}
