import { getNinoxConfig, loadEnvironment } from "../config/env.js";
import { AxiosReadOnlyNinoxClient } from "../ninox/client.js";
import { sanitizeError } from "../ninox/sanitize.js";
import { inspectMetadata, writeMetadataOutput } from "../scanner/inspectMetadata.js";

loadEnvironment();

try {
  const config = getNinoxConfig();
  const result = await inspectMetadata(new AxiosReadOnlyNinoxClient(config));
  const outputPath = await writeMetadataOutput(result);
  console.log(`Metadata inspected: ${result.fieldCount} fields`);
  console.log(`Metadata saved to ${outputPath}`);
  console.log("READ ONLY — No Ninox data modified.");
} catch (error) {
  const safe = sanitizeError(error);
  console.error(`✗ ${safe.message}`);
  process.exitCode = 1;
}
