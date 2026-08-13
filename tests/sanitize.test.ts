import axios, { AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { sanitizeError } from "../src/ninox/sanitize.js";

describe("sanitizeError", () => {
  it("does not expose Axios request configuration", () => {
    const error = new axios.AxiosError("raw secret message", "ERR_BAD_REQUEST", {
      headers: new AxiosHeaders({ Authorization: "Bearer should-not-leak" }),
    });
    error.response = { status: 401 } as never;
    expect(sanitizeError(error)).toEqual({ status: 401, message: "401 Unauthorized" });
  });
});
