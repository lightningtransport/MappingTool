import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

export interface NinoxConfig {
  baseUrl: string;
  token: string;
  teamId: string;
  databaseId: string;
  sampleLimit: number;
  timeoutMs: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadEnvironment(): void {
  loadDotenv({ path: resolve(process.cwd(), ".env.local"), quiet: true });
}

function required(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ConfigError(`${name} must be a positive integer`);
  }
  return value;
}

export function getNinoxConfig(env: NodeJS.ProcessEnv = process.env): NinoxConfig {
  const baseUrl = required("NINOX_BASE_URL", env).replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ConfigError("NINOX_BASE_URL must be a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new ConfigError("NINOX_BASE_URL must use HTTPS");
  }

  return {
    baseUrl,
    token: required("NINOX_TOKEN", env),
    teamId: required("NINOX_TEAM_ID", env),
    databaseId: required("NINOX_DATABASE_ID", env),
    sampleLimit: positiveInteger("NINOX_SAMPLE_LIMIT", 20, env),
    timeoutMs: positiveInteger("NINOX_TIMEOUT_MS", 20_000, env),
  };
}
