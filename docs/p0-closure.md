# Ninox Data Mapper P0 closure

Audit date: 2026-08-13

> Historical snapshot: this document records the evidence available when P0 was closed. It is not the current scan status. See [`p1-status.md`](p1-status.md) for the latest timestamped counters and P1 progress.

## Outcome

P0 is complete for the current Ninox Private Cloud database. The mapper discovers the live schema, samples records, extracts explicit `ref` relationships, validates matching `rev` metadata when present, keeps unsupported destinations unresolved, writes local artifacts, and exposes the result through a read-only Next.js explorer.

Latest verified scan:

- 163 tables
- 5,139 fields
- 2,164 sampled records
- 112 unique forward references
- 109 confirmed Ninox relationships
- 0 sample-detected hypotheses
- 3 unresolved Ninox references
- 94 connected tables
- 69 isolated tables
- 0 scan errors

## P0 acceptance matrix

| Requirement | Status | Evidence |
| --- | --- | --- |
| Connect to the real Ninox Private Cloud database | Passed | A live UI rescan completed on 2026-08-13 and regenerated all artifacts. |
| Discover tables, IDs and fields | Passed | `output/schema.json` contains 163 tables and 5,139 fields. |
| Sample records without inventing pagination | Passed | The approved records endpoint is read and the configured limit is applied locally. |
| Extract explicit relationships | Passed | Forward `ref` fields produce 109 resolved relationships and 3 unresolved references. |
| Consume reverse metadata | Passed | Matching `rev` fields are used as validation metadata and are not emitted as duplicate graph edges. |
| Detect possible relationships from samples | Passed | The detector is implemented and tested; the current evidence produces 0 hypotheses. |
| Preserve unknown facts as unknown | Passed | Three references to table ID `UC` remain unresolved with reason `target-not-in-schema`. |
| Generate local JSON artifacts | Passed | Schema, relationships, scan summary, samples, Shop map and quality report are regenerated together. |
| Explore the complete database | Passed | The UI exposes all 163 tables and all 112 relationships; the TrucksDB area remains an optional scope filter. |
| Show a centered direct-neighbor graph | Passed | Selecting a table rebuilds the SVG around that table and uses the same source/direction filters as the list. |
| Report map quality | Passed | The UI and `data-quality.json` distinguish confirmed, detected and unresolved evidence. |
| Re-scan safely from the local UI | Passed | The Server Action runs in Node.js, prevents concurrent scans, sanitizes errors and revalidates the page. |
| Keep Ninox integration read-only | Passed | The Ninox client exposes and executes GET only. |
| Keep credentials server-side | Passed | `.env.local` is ignored; production client bundles contain no token, Authorization marker or environment values. |
| Pass automated validation | Passed | Typecheck, 42 tests and the production build pass. |

## Unresolved `UC` evidence

The API currently returns table ID `UC` as the destination for three `Trailers` fields, but `UC` is absent from the 163-table catalog returned by the approved schema endpoints:

| Source table | Source table ID | Source field ID | Destination |
| --- | --- | --- | --- |
| Repairs_Record | `V` | `J4` | `UC` |
| Repair Records | `PH` | `J6` | `UC` |
| Trailers_Repair_ | `BI` | `M` | `UC` |

This can indicate a deleted, inaccessible or otherwise non-catalogued table, but P0 does not choose among those explanations without API evidence. The destination remains `Unknown` in the explorer and quality report.

## Verification evidence

- The live rescan completed in 16,811 ms and refreshed the generated timestamp without restarting Next.js.
- The running state disabled the Rescan button, and the final state reported 163 tables and 112 references.
- Selecting `Repairs_Record` displayed all four direct relationships.
- Filtering that table to unresolved evidence displayed exactly one edge: `Trailers` to the unknown `UC` destination.
- The page rendered without a Next.js error overlay, console warnings or console errors.
- At a 390 px viewport, the page had no horizontal overflow and retained readable controls and metrics.
- The current relationship artifact contains no duplicate forward-reference keys.

## P1 boundary

P1 should begin with evidence collection for `UC`, using only the already approved GET endpoints:

1. Compare the database-level schema payload, table catalog and the three source-table payloads in one diagnostic artifact.
2. Record whether any reverse metadata elsewhere points from `UC`, without treating it as a resolvable table.
3. Add scan-to-scan diffs so deleted, renamed or newly inaccessible tables can be distinguished over time.
4. Consider a filesystem lock only if the tool moves beyond the current single-user, single-process local runtime.

No write endpoint, guessed metadata endpoint or visual Ninox navigation hierarchy should be introduced to resolve `UC`.

## Tooling note

The configured Luna-first agent loop routed correctly in dry-run. Its local app-server client was blocked by an operating-system permission error before the coordinator could execute, so the closure audit used deterministic source inspection, automated checks and a live browser/API walkthrough. Terra and Sol were not invoked.
