export type ModelAlias = "luna" | "terra" | "sol";
export type ReasoningEffort = "low" | "medium" | "high";
export type AgentRunStatus = "passed" | "failed" | "blocked";

export interface ModelRoute {
  alias: ModelAlias;
  model: string;
  effort: ReasoningEffort;
}

export interface AgentResult {
  status: AgentRunStatus;
  summary: string;
  tests: string[];
  nextAction: string | null;
}

export interface RoundSummary {
  round: number;
  route: ModelRoute;
  coordinator?: AgentResult;
  builder?: AgentResult;
  verifier?: AgentResult;
}

export interface AgentRunSummary {
  task: string;
  status: AgentRunStatus;
  rounds: RoundSummary[];
  finalReview?: AgentResult;
  nextAction: string | null;
}
