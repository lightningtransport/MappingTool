---
name: ninox-data-mapper
description: Build, inspect, test, or extend the Ninox Data Mapper P0 extractor and its Ninox Private Cloud integration. Use for connection checks, table or field discovery, record sampling, relationship analysis, scan JSON output, read-only API safety, and Shop data mapping in this repository.
---

# Ninox Data Mapper

Implement the extractor before the UI. Read `references/prd-p0.md` when scoping a feature and `references/ninox-api.md` before changing API calls.

## Workflow

1. Inspect the current implementation and select the next incomplete P0 stage.
2. Preserve strict read-only behavior: expose and execute GET only.
3. Keep `.env.local` server-side and redact tokens and Authorization headers from all output.
4. Validate actual Ninox response shapes. Preserve raw data and mark absent metadata `Unknown`; never infer API facts without evidence.
5. Run `npm run typecheck` and `npm test`. Run `npm run test:connection` only when live API verification is relevant.
6. Report implemented behavior, validation evidence, API limitations, and the next P0 stage.

## Agent loop

Use `npm run agent:loop -- --task "..." --dry-run` to inspect routing without spending model tokens. For execution, default to Luna/low, escalate a failed verified attempt to Terra/medium, and reserve Sol/high for round three or `--final-review`. Stop after three rounds or when authority is missing.
