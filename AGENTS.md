# Ninox Data Mapper

Build the P0 extractor before any Next.js interface. Follow the PRD in `docs/prd-p0.md`.

## Non-negotiable rules

- Treat Ninox as strictly read-only. The HTTP client may expose and execute only GET.
- Never add POST, PUT, PATCH, DELETE, writable queries, or file uploads.
- Keep credentials only in `.env.local`. Never print tokens or Authorization headers.
- Do not invent endpoints, field types, metadata, or relationships. Preserve raw responses and mark missing information as `Unknown`.
- Prefer small, independently verifiable changes. Run typecheck and tests after implementation.
- Build in this order: connection, tables, one table, samples, metadata, relationships, JSON output, CLI scan, then UI.

## Agent workflow

- Use `gpt-5.6-luna` with low reasoning for routine work.
- Escalate to `gpt-5.6-terra` with medium reasoning after a failed verified attempt.
- Reserve `gpt-5.6-sol` with high reasoning for a third attempt or explicit final review.
- Stop after three rounds, on missing authority, or before any destructive/external write.
