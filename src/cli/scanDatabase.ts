import { getNinoxConfig, loadEnvironment } from "../config/env.js";
import { AxiosReadOnlyNinoxClient } from "../ninox/client.js";
import { sanitizeError } from "../ninox/sanitize.js";
import { scanDatabase, writeDatabaseScan } from "../scanner/scanDatabase.js";

loadEnvironment();

try {
  const config = getNinoxConfig();
  const result = await scanDatabase(new AxiosReadOnlyNinoxClient(config), 5);
  await writeDatabaseScan(result);
  console.log(`Scan complete: ${result.tableCount} tables, ${result.fieldCount} fields`);
  console.log(`Sampled records: ${result.sampledRecords}`);
  console.log(`Relationships: ${result.relationships.counts.ninox} Ninox, ${result.relationships.counts.detected} detected, ${result.relationships.counts.unknown} unknown`);
  console.log(`Errors: ${result.errors.length}`);
  console.log("Output saved to ./output");
  console.log("READ ONLY — No Ninox data modified.");
} catch (error) {
  const safe = sanitizeError(error);
  console.error(`✗ ${safe.message}`);
  process.exitCode = 1;
}
