import { getNinoxConfig, loadEnvironment } from "../config/env.js";
import { AxiosReadOnlyNinoxClient } from "../ninox/client.js";
import { sanitizeError } from "../ninox/sanitize.js";
import { discoverRelationships, writeRelationshipsOutput } from "../scanner/relationshipAnalyzer.js";

loadEnvironment();

try {
  const config = getNinoxConfig();
  const result = await discoverRelationships(new AxiosReadOnlyNinoxClient(config));
  const outputPath = await writeRelationshipsOutput(result);
  console.log(`Relationships discovered: ${result.relationships.length}`);
  console.log(`Ninox: ${result.counts.ninox} | Detected: ${result.counts.detected} | Unknown: ${result.counts.unknown}`);
  for (const relationship of result.relationships) {
    console.log(`${relationship.sourceTable}.${relationship.sourceField} → ${relationship.targetTable}.id`);
  }
  console.log(`Relationships saved to ${outputPath}`);
  console.log("READ ONLY — No Ninox data modified.");
} catch (error) {
  const safe = sanitizeError(error);
  console.error(`✗ ${safe.message}`);
  process.exitCode = 1;
}
