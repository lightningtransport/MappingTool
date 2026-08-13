import { getNinoxConfig, loadEnvironment } from "../config/env.js";
import { AxiosReadOnlyNinoxClient } from "../ninox/client.js";
import { sanitizeError } from "../ninox/sanitize.js";
import { sampleRecords, writeSampleOutput } from "../scanner/sampleRecords.js";

loadEnvironment();

const requestedLimit = Number(process.argv[2] ?? "");

try {
  const config = getNinoxConfig();
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? requestedLimit
    : config.sampleLimit;
  const result = await sampleRecords(
    new AxiosReadOnlyNinoxClient(config),
    "E",
    limit,
  );
  const outputPath = await writeSampleOutput(result);
  console.log(`TrucksDB records sampled: ${result.recordCount}/${result.requestedLimit}`);
  console.log(`Samples saved to ${outputPath}`);
  console.log("READ ONLY — No Ninox data modified.");
} catch (error) {
  const safe = sanitizeError(error);
  console.error(`✗ ${safe.message}`);
  process.exitCode = 1;
}
