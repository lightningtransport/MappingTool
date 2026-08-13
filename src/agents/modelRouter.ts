import type { ModelAlias, ModelRoute, ReasoningEffort } from "./types.js";

const ROUTES: Record<ModelAlias, ModelRoute> = {
  luna: { alias: "luna", model: "gpt-5.6-luna", effort: "low" },
  terra: { alias: "terra", model: "gpt-5.6-terra", effort: "medium" },
  sol: { alias: "sol", model: "gpt-5.6-sol", effort: "high" },
};

export function routeForRound(round: number, override?: ModelAlias, effort?: ReasoningEffort): ModelRoute {
  if (!Number.isSafeInteger(round) || round < 1 || round > 3) {
    throw new Error("Round must be between 1 and 3");
  }
  const alias = override ?? (["luna", "terra", "sol"] as const)[round - 1];
  if (!alias) throw new Error("No model route for round");
  return { ...ROUTES[alias], effort: effort ?? ROUTES[alias].effort };
}
