import { describe, expect, it } from "vitest";
import { finalReviewRoute, routeForRound } from "../src/agents/modelRouter.js";
import { DEFAULT_AGENT_ROUNDS, normalizeAgentResult, processFailure } from "../src/agents/workflow.js";

describe("model routing", () => {
  it("limits implementation rounds to Luna then Terra", () => {
    expect(routeForRound(1)).toMatchObject({ model: "gpt-5.6-luna", effort: "low" });
    expect(routeForRound(2)).toMatchObject({ model: "gpt-5.6-terra", effort: "medium" });
    expect(() => routeForRound(3)).toThrow("Implementation round must be 1 or 2");
    expect(DEFAULT_AGENT_ROUNDS).toBe(2);
  });

  it("supports a manual override", () => {
    expect(routeForRound(1, "terra", "low")).toMatchObject({ model: "gpt-5.6-terra", effort: "low" });
    expect(() => routeForRound(1, "sol")).toThrow("Sol is reserved for explicit final review");
  });

  it("reserves Sol for explicit final review", () => {
    expect(finalReviewRoute()).toEqual({ alias: "sol", model: "gpt-5.6-sol", effort: "high" });
  });

  it("distinguishes infrastructure from implementation failures", () => {
    expect(processFailure("coordinator", 1, "Operation not permitted (os error 1)")).toMatchObject({ status: "blocked", failureKind: "infrastructure" });
    expect(processFailure("builder", 1, "unexpected CLI exit")).toMatchObject({ status: "blocked", failureKind: "invalid-output" });
    expect(normalizeAgentResult({ status: "failed", summary: "test failed", tests: [], nextAction: "fix test" })).toMatchObject({ status: "failed", failureKind: "implementation" });
  });
});
