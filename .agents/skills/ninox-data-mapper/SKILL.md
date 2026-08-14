---
name: ninox-data-mapper
description: Build, inspect, test, or extend Ninox Data Mapper P0/P1 and its read-only Ninox Private Cloud integration. Use for schema and field discovery, record sampling, relationship evidence, local scan history, review annotations, privacy-safe profiling, P1 reports, rescan safety, or the Next.js explorer in this repository.
---

# Ninox Data Mapper

Preserve the completed extractor while extending the mapper. Read `references/prd-p0.md` for discovery work, `references/prd-p1.md` for review/reporting work, and `references/ninox-api.md` before changing API calls.

## Workflow

1. Inspect the current implementation and select one incomplete P0 or P1 milestone.
2. Preserve strict read-only behavior: expose and execute GET only.
3. Keep `.env.local` server-side and redact tokens and Authorization headers from all output.
4. Validate actual Ninox response shapes. Preserve raw data and mark absent metadata `Unknown`; never infer API facts without evidence.
5. Keep human annotations separate from Ninox evidence. Label profiles based on 20 records as sample-based and persist no values in profile/report artifacts.
6. Run `npm run typecheck`, `npm test`, and `npm run build`. Run `npm run test:connection` only when live API verification is relevant.
7. Report implemented behavior, validation evidence, API limitations, and the next milestone.

## Agent loop

Use `npm run agent:loop -- --task "..." --dry-run` before execution. Use at most two rounds: Luna/low first, Terra/medium only after a failed verifier result. Reserve Sol/high exclusively for an explicitly authorized `--final-review`. Stop without escalation on infrastructure failure or missing authority.
