import { getNinoxConfig, loadEnvironment } from "../config/env.js";
import { AxiosReadOnlyNinoxClient } from "../ninox/client.js";
import { sanitizeError } from "../ninox/sanitize.js";
import { sampleTrucksDb, writeTrucksDbSampleOutput } from "../scanner/inspectTable.js";

loadEnvironment();

try {
  const config = getNinoxConfig();
  const outputPath = await writeTrucksDbSampleOutput(
    await sampleTrucksDb(new AxiosReadOnlyNinoxClient(config)),
  );
  console.log(`TrucksDB samples saved to ${outputPath}`);
  console.log("READ ONLY — No Ninox data modified.");
} catch (error) {
  const safe = sanitizeError(error);
  console.error(`✗ ${safe.message}`);
  process.exitCode = 1;
}
