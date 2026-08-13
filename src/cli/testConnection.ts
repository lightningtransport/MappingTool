import { getNinoxConfig, loadEnvironment } from "../config/env.js";
import { testConnection } from "../ninox/connection.js";

loadEnvironment();

console.log("NINOX DATA MAPPER\n");
console.log("Connection");

try {
  const config = getNinoxConfig();
  const result = await testConnection(config);
  if (!result.connected) {
    console.error("● Connection Failed");
    console.error(result.error ?? "Unknown error");
    process.exitCode = 1;
  } else {
    console.log("● Connected");
    if (result.databaseName) console.log(`Database: ${result.databaseName}`);
  }
  console.log(`Database ID: ${result.databaseId}`);
  console.log("Mode: READ ONLY");
} catch (error) {
  console.error("● Configuration Failed");
  console.error(error instanceof Error ? error.message : "Invalid configuration");
  process.exitCode = 1;
}
