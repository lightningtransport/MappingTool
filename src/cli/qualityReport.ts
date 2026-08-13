import { sanitizeError } from "../ninox/sanitize.js";
import { generateDataQualityReport, writeDataQualityReport } from "../scanner/dataQuality.js";

try {
  const report = await generateDataQualityReport();
  const outputPath = await writeDataQualityReport(report);
  console.log(`Quality report: ${report.tables.connected}/${report.tables.total} connected tables`);
  console.log(`Isolated: ${report.tables.isolated}; hypothesis only: ${report.tables.hypothesisOnly}`);
  console.log(`Unresolved references: ${report.unresolvedReferences.length}; scan errors: ${report.scanErrors.length}`);
  console.log(`Saved to ${outputPath}`);
} catch (error) {
  const safe = sanitizeError(error);
  console.error(`✗ ${safe.message}`);
  process.exitCode = 1;
}
