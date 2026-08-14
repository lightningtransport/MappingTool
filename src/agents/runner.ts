import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getNinoxConfig, loadEnvironment } from "../config/env.js";
import { finalReviewRoute, routeForRound } from "./modelRouter.js";
import { DEFAULT_AGENT_ROUNDS, normalizeAgentResult, processFailure } from "./workflow.js";
import type {
  AgentResult,
  AgentRunSummary,
  ModelAlias,
  ModelRoute,
  ReasoningEffort,
  RoundSummary,
} from "./types.js";

interface Options {
  task: string;
  model?: ModelAlias;
  effort?: ReasoningEffort;
  rounds: number;
  finalReview: boolean;
  dryRun: boolean;
}

const RESULT_SCHEMA = resolve("config/agent-result.schema.json");
const RUNS_DIR = resolve(".agent-runs");

function usage(): never {
  console.error("Usage: npm run agent:loop -- --task \"...\" [--model luna|terra] [--effort low|medium|high] [--rounds 1..2] [--final-review] [--dry-run]");
  process.exit(2);
}

function parseOptions(args: string[]): Options {
  let task = "";
  let model: ModelAlias | undefined;
  let effort: ReasoningEffort | undefined;
  let rounds = DEFAULT_AGENT_ROUNDS;
  let finalReview = false;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--task") task = args[++index] ?? "";
    else if (arg === "--model") model = args[++index] as ModelAlias;
    else if (arg === "--effort") effort = args[++index] as ReasoningEffort;
    else if (arg === "--rounds") rounds = Number(args[++index]);
    else if (arg === "--final-review") finalReview = true;
    else if (arg === "--dry-run") dryRun = true;
    else usage();
  }

  if (!task.trim()) usage();
  if (model && !["luna", "terra"].includes(model)) usage();
  if (effort && !["low", "medium", "high"].includes(effort)) usage();
  if (!Number.isSafeInteger(rounds) || rounds < 1 || rounds > 2) usage();
  return { task: task.trim(), model, effort, rounds, finalReview, dryRun };
}

async function promptFor(
  role: string,
  task: string,
  round: number,
  totalRounds: number,
  contextLabel: string,
  context: AgentResult | null,
): Promise<string> {
  const rolePrompt = await readFile(resolve(`prompts/${role}.md`), "utf8");
  return [
    rolePrompt,
    `Task: ${task}`,
    `Round: ${round} of ${totalRounds}`,
    context ? `${contextLabel}: ${JSON.stringify(context)}` : `${contextLabel}: none`,
    "Follow AGENTS.md. Return only the required structured result.",
  ].join("\n\n");
}

async function runAgent(role: string, route: ModelRoute, prompt: string, outputPath: string): Promise<AgentResult> {
  const args = [
    "exec",
    "--model", route.model,
    "-c", `model_reasoning_effort=\"${route.effort}\"`,
    "-c", "approval_policy=\"never\"",
    "--sandbox", "workspace-write",
    "--output-schema", RESULT_SCHEMA,
    "--output-last-message", outputPath,
    prompt,
  ];
  const result = spawnSync("codex", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const detail = result.stderr?.trim().split("\n").at(-1) ?? "No stderr available";
    return processFailure(role, result.status, detail);
  }
  try {
    return normalizeAgentResult(JSON.parse(await readFile(outputPath, "utf8")) as AgentResult);
  } catch {
    return { status: "blocked", failureKind: "invalid-output", summary: `${role} returned invalid structured output`, tests: [], nextAction: "Inspect the agent output and schema before another model round." };
  }
}

const options = parseOptions(process.argv.slice(2));
const plannedRoutes = Array.from({ length: options.rounds }, (_, index) => routeForRound(index + 1, options.model, options.effort));

if (options.dryRun) {
  console.log(JSON.stringify({ task: options.task, routes: plannedRoutes, finalReview: options.finalReview ? finalReviewRoute() : null }, null, 2));
  process.exit(0);
}

loadEnvironment();
getNinoxConfig();

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = resolve(RUNS_DIR, runId);
await mkdir(runDir, { recursive: true });
const rounds: RoundSummary[] = [];
let previousVerifier: AgentResult | null = null;
let status: AgentRunSummary["status"] = "failed";

for (let index = 0; index < plannedRoutes.length; index += 1) {
  const roundNumber = index + 1;
  const route = plannedRoutes[index];
  if (!route) break;
  const round: RoundSummary = { round: roundNumber, route };

  if (roundNumber === 1) {
    round.coordinator = await runAgent(
      "coordinator",
      route,
      await promptFor("coordinator", options.task, roundNumber, options.rounds, "Prior context", null),
      resolve(runDir, `round-${roundNumber}-coordinator.json`),
    );
    if (round.coordinator.status === "blocked") {
      rounds.push(round);
      status = "blocked";
      break;
    }
  }

  round.builder = await runAgent(
    "builder",
    route,
    await promptFor(
      "builder",
      options.task,
      roundNumber,
      options.rounds,
      roundNumber === 1 ? "Coordinator decision" : "Previous verifier result",
      roundNumber === 1 ? round.coordinator ?? null : previousVerifier,
    ),
    resolve(runDir, `round-${roundNumber}-builder.json`),
  );
  if (round.builder.status === "blocked") {
    rounds.push(round);
    status = "blocked";
    break;
  }

  round.verifier = await runAgent(
    "verifier",
    route,
    await promptFor("verifier", options.task, roundNumber, options.rounds, "Builder result", round.builder),
    resolve(runDir, `round-${roundNumber}-verifier.json`),
  );
  previousVerifier = round.verifier;
  rounds.push(round);

  if (round.verifier.status === "passed") {
    status = "passed";
    break;
  }
  if (round.verifier.status === "blocked") {
    status = "blocked";
    break;
  }
}

const summary: AgentRunSummary = {
  task: options.task,
  status,
  rounds,
  nextAction: previousVerifier?.nextAction ?? (status === "passed" ? null : "Review the final verifier result."),
};

if (options.finalReview && status === "passed") {
  const reviewRoute = finalReviewRoute();
  summary.finalReview = await runAgent(
    "reviewer",
    reviewRoute,
    await promptFor("reviewer", options.task, rounds.length, options.rounds, "Passing verifier result", previousVerifier),
    resolve(runDir, "final-review.json"),
  );
  if (summary.finalReview.status !== "passed") {
    summary.status = summary.finalReview.status;
    summary.nextAction = summary.finalReview.nextAction;
  }
}

await writeFile(resolve(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.status === "passed" ? 0 : 1;
