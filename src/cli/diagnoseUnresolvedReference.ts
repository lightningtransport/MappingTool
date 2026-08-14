import { getNinoxConfig, loadEnvironment } from "../config/env.js";
import { AxiosReadOnlyNinoxClient } from "../ninox/client.js";
import { sanitizeError } from "../ninox/sanitize.js";
import { diagnoseUnresolvedReference, writeUnresolvedReferenceDiagnostic } from "../scanner/unresolvedReferenceDiagnostic.js";

loadEnvironment();

try {
  const targetTableId = process.argv[2]?.trim() || "UC";
  const client = new AxiosReadOnlyNinoxClient(getNinoxConfig());
  const diagnostic = await diagnoseUnresolvedReference(client, targetTableId);
  const outputPath = await writeUnresolvedReferenceDiagnostic(diagnostic);
  console.log(`Target ${targetTableId}: ${diagnostic.assessment}`);
  console.log(`Catalogued: ${diagnostic.catalog.targetPresent ? "yes" : "no"}; direct GET: ${diagnostic.targetProbe.status}`);
  console.log(`Forward refs: ${diagnostic.forwardReferences.length}; reverse refs: ${diagnostic.reverseReferences.length}`);
  console.log(`Inspection errors: ${diagnostic.inspectionErrors.length}`);
  console.log(`Saved to ${outputPath}`);
  console.log("READ ONLY — No Ninox data modified.");
} catch (error) {
  const safe = sanitizeError(error);
  console.error(`✗ ${safe.message}`);
  process.exitCode = 1;
}
