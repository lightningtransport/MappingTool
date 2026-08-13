import { describe, expect, it } from "vitest";
import { ConfigError, getNinoxConfig } from "../src/config/env.js";

const valid = {
  NINOX_BASE_URL: "https://example.ninoxdb.com/v1/ ",
  NINOX_TOKEN: " token ",
  NINOX_TEAM_ID: " team ",
  NINOX_DATABASE_ID: " database\u00a0",
};

describe("getNinoxConfig", () => {
  it("normalizes values and applies defaults", () => {
    expect(getNinoxConfig(valid)).toEqual({
      baseUrl: "https://example.ninoxdb.com/v1",
      token: "token",
      teamId: "team",
      databaseId: "database",
      sampleLimit: 20,
      timeoutMs: 20_000,
    });
  });

  it("rejects missing secrets", () => {
    expect(() => getNinoxConfig({ ...valid, NINOX_TOKEN: "" })).toThrow(ConfigError);
  });

  it("rejects non-HTTPS base URLs", () => {
    expect(() => getNinoxConfig({ ...valid, NINOX_BASE_URL: "http://example.com/v1" })).toThrow("HTTPS");
  });
});
