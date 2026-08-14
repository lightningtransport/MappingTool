import type { ModelAlias, ModelRoute, ReasoningEffort } from "./types.js";

const ROUTES: Record<ModelAlias, ModelRoute> = {
  luna: { alias: "luna", model: "gpt-5.6-luna", effort: "low" },
  terra: { alias: "terra", model: "gpt-5.6-terra", effort: "medium" },
  sol: { alias: "sol", model: "gpt-5.6-sol", effort: "high" },
};

export function routeForRound(round: number, override?: ModelAlias, effort?: ReasoningEffort): ModelRoute {
  if (!Number.isSafeInteger(round) || round < 1 || round > 2) {
    throw new Error("Implementation round must be 1 or 2");
  }
  if (override === "sol") throw new Error("Sol is reserved for explicit final review");
  const alias = override ?? (["luna", "terra"] as const)[round - 1];
  if (!alias) throw new Error("No model route for round");
  return { ...ROUTES[alias], effort: effort ?? ROUTES[alias].effort };
}

export function finalReviewRoute(): ModelRoute {
  return { ...ROUTES.sol };
}
