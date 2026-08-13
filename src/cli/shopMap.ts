import { writeShopMap, buildShopMap } from "../scanner/shopMap.js";

try {
  const result = await buildShopMap();
  const outputPath = await writeShopMap();
  console.log(`Shop map: ${result.nodes.length} tables, ${result.edges.length} edges`);
  console.log(`Hypotheses requiring review: ${result.hypotheses.length}`);
  console.log(`Saved to ${outputPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to build Shop map");
  process.exitCode = 1;
}
