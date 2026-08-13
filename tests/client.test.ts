import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import type { NinoxConfig } from "../src/config/env.js";
import { AxiosReadOnlyNinoxClient } from "../src/ninox/client.js";

const config: NinoxConfig = {
  baseUrl: "https://example.ninoxdb.com/v1",
  token: "secret",
  teamId: "team/id",
  databaseId: "database id",
  sampleLimit: 2,
  timeoutMs: 1000,
};

describe("AxiosReadOnlyNinoxClient", () => {
  it("uses GET and encodes path segments", async () => {
    const get = vi.fn().mockResolvedValue({ data: { id: "database id" } });
    const client = new AxiosReadOnlyNinoxClient(config, { get } as unknown as AxiosInstance);
    await client.getDatabaseSchema();
    expect(get).toHaveBeenCalledWith("/teams/team%2Fid/databases/database%20id", undefined);
  });

  it("limits sample records locally", async () => {
    const get = vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    const client = new AxiosReadOnlyNinoxClient(config, { get } as unknown as AxiosInstance);
    await expect(client.getSampleRecords("A")).resolves.toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("samples table E through the records GET endpoint", async () => {
    const get = vi.fn().mockResolvedValue({ data: [{ id: 1, unknown: { value: true } }] });
    const client = new AxiosReadOnlyNinoxClient(config, { get } as unknown as AxiosInstance);
    await expect(client.getSampleRecords("E", 20)).resolves.toEqual([{ id: 1, unknown: { value: true } }]);
    expect(get).toHaveBeenCalledWith(
      "/teams/team%2Fid/databases/database%20id/tables/E/records",
      undefined,
    );
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects invalid sample limit %s", async (limit) => {
    const get = vi.fn();
    const client = new AxiosReadOnlyNinoxClient(config, { get } as unknown as AxiosInstance);
    await expect(client.getSampleRecords("E", limit)).rejects.toThrow("Sample limit must be positive");
    expect(get).not.toHaveBeenCalled();
  });

  it("exposes no mutation method", () => {
    const client = new AxiosReadOnlyNinoxClient(config, { get: vi.fn() } as unknown as AxiosInstance);
    expect("post" in client).toBe(false);
    expect("put" in client).toBe(false);
    expect("patch" in client).toBe(false);
    expect("delete" in client).toBe(false);
  });
});
