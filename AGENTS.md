# Ninox Data Mapper

Maintain the completed P0 extractor while extending the local mapper through P1. Follow `docs/prd-p0.md` for discovery requirements and the active P1 milestone in `.agents/skills/ninox-data-mapper/references/prd-p1.md`.

## Non-negotiable rules

- Treat Ninox as strictly read-only. The HTTP client may expose and execute only GET.
- Never add POST, PUT, PATCH, DELETE, writable queries, or file uploads.
- Keep credentials only in `.env.local`. Never print tokens or Authorization headers.
- Do not invent endpoints, field types, metadata, or relationships. Preserve raw responses and mark missing information as `Unknown`.
- Keep annotations and generated P1 analysis local under ignored `output/` paths. Never send them to Ninox.
- Treat human review as opinion, sample profiles as sample-based evidence, and absent metadata as `Unknown`.
- Prefer small, independently verifiable milestones. Run typecheck, tests, and build before each commit.

## Agent workflow

- Run a dry-run before every agent loop.
- Use `gpt-5.6-luna` with low reasoning for round one.
- Escalate to `gpt-5.6-terra` with medium reasoning only after a failed verifier result.
- Limit implementation loops to two rounds. Use `gpt-5.6-sol` only with explicit `--final-review` authorization.
- Do not escalate model effort for infrastructure failures. Stop on missing authority or before destructive/external writes.
