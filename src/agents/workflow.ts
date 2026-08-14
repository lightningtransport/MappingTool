import type { AgentResult } from "./types.js";

export const DEFAULT_AGENT_ROUNDS = 2;

const INFRASTRUCTURE_FAILURE = /operation not permitted|failed to initialize in-process app-server client|\bEACCES\b|\bEPERM\b|command not found|\bENOENT\b/i;

export function processFailure(role: string, status: number | null, detail: string): AgentResult {
  const infrastructure = INFRASTRUCTURE_FAILURE.test(detail);
  return {
    status: "blocked",
    failureKind: infrastructure ? "infrastructure" : "invalid-output",
    summary: `${role} exited with code ${status ?? "unknown"}: ${detail}`,
    tests: [],
    nextAction: infrastructure
      ? "Fix or authorize the local agent launcher; do not escalate model effort."
      : "Inspect the local Codex execution error before another model round.",
  };
}

export function normalizeAgentResult(result: AgentResult): AgentResult {
  return result.status === "failed" && !result.failureKind
    ? { ...result, failureKind: "implementation" }
    : result;
}
