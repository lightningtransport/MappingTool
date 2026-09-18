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

  it("paginates records with documented GET parameters when the limit exceeds 100", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }));
    const secondPage = Array.from({ length: 60 }, (_, index) => ({ id: index + 101 }));
    const get = vi.fn()
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: secondPage });
    const client = new AxiosReadOnlyNinoxClient(config, { get } as unknown as AxiosInstance);

    const records = await client.getSampleRecords("E", 1000);

    expect(records).toHaveLength(160);
    expect(records.at(-1)).toEqual({ id: 160 });
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/teams/team%2Fid/databases/database%20id/tables/E/records",
      { params: { page: 1, perPage: 100 } },
    );
  });

  it("stops safely if a server ignores pagination and repeats the first page", async () => {
    const page = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }));
    const get = vi.fn().mockResolvedValue({ data: page });
    const client = new AxiosReadOnlyNinoxClient(config, { get } as unknown as AxiosInstance);

    await expect(client.getSampleRecords("E", 1000)).resolves.toHaveLength(100);
    expect(get).toHaveBeenCalledTimes(2);
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
