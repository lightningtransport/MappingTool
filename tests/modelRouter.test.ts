import { describe, expect, it } from "vitest";
import { routeForRound } from "../src/agents/modelRouter.js";

describe("model routing", () => {
  it("escalates Luna to Terra to Sol", () => {
    expect(routeForRound(1)).toMatchObject({ model: "gpt-5.6-luna", effort: "low" });
    expect(routeForRound(2)).toMatchObject({ model: "gpt-5.6-terra", effort: "medium" });
    expect(routeForRound(3)).toMatchObject({ model: "gpt-5.6-sol", effort: "high" });
  });

  it("supports a manual override", () => {
    expect(routeForRound(1, "terra", "low")).toMatchObject({ model: "gpt-5.6-terra", effort: "low" });
  });
});
