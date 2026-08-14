import { access, chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const force = process.argv.includes("--force");
const sourceArgument = process.argv.slice(2).find((argument) => argument !== "--force");
const sourcePath = resolve(sourceArgument ?? "/Users/cristianperez/Documents/Ninox api/Ninox api.md");
const destinationPath = resolve(process.cwd(), ".env.local");

const baseUrl = process.env.NINOX_BASE_URL?.trim().replace(/\/+$/, "");
if (!baseUrl) {
  throw new Error("Set NINOX_BASE_URL in the process environment before importing credentials.");
}

let parsedBaseUrl;
try {
  parsedBaseUrl = new URL(baseUrl);
} catch {
  throw new Error("NINOX_BASE_URL must be a valid URL.");
}
if (parsedBaseUrl.protocol !== "https:") {
  throw new Error("NINOX_BASE_URL must use HTTPS.");
}

if (!force) {
  try {
    await access(destinationPath);
    throw new Error(".env.local already exists. Use --force only when replacement is intentional.");
  } catch (error) {
    if (error instanceof Error && !error.message.includes("ENOENT")) throw error;
  }
}

const source = await readFile(sourcePath, "utf8");

const readValue = (label) => {
  const match = source.match(new RegExp(`^${label}:\\s*([^\\s]+)`, "mu"));
  if (!match?.[1]) {
    throw new Error(`Missing ${label} in credential source`);
  }
  return match[1].trim();
};

const token = readValue("API");
const teamId = readValue("Workspace");
const databaseId = readValue("DB id");
const content = [
  `NINOX_BASE_URL=${baseUrl}`,
  `NINOX_TOKEN=${token}`,
  `NINOX_TEAM_ID=${teamId}`,
  `NINOX_DATABASE_ID=${databaseId}`,
  "NINOX_SAMPLE_LIMIT=20",
  "NINOX_TIMEOUT_MS=20000",
  "",
].join("\n");

await writeFile(destinationPath, content, { encoding: "utf8", mode: 0o600 });
await chmod(destinationPath, 0o600);
console.log("Created .env.local with restricted permissions. Secret values were not printed.");
