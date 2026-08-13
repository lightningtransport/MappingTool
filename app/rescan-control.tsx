"use client";

import { useActionState } from "react";
import { rescanNinox } from "./rescan-action.js";
import type { ScanActionState } from "../src/rescan/rescanNinox.js";

const initialState: ScanActionState = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  counts: null,
  error: null,
};

export default function RescanControl() {
  const [state, formAction, pending] = useActionState(rescanNinox, initialState);

  const relationshipCount = state.counts
    ? state.counts.ninox + state.counts.detected + state.counts.unknown
    : 0;

  return <div className="rescan-control">
    <form action={formAction}><button type="submit" disabled={pending}>{pending ? "Rescanning…" : "Rescan"}</button></form>
    <div className={`rescan-state ${pending ? "running" : state.status}`} aria-live="polite">
      {pending && <span>Scanning Ninox metadata and samples…</span>}
      {!pending && state.status === "success" && state.counts && <span>Updated {state.finishedAt} · {state.counts.tables} tables · {relationshipCount} references · {state.durationMs} ms</span>}
      {!pending && state.status === "error" && <span>{state.error}</span>}
      {!pending && state.status === "idle" && <span>Refresh local read-only artifacts</span>}
    </div>
  </div>;
}
