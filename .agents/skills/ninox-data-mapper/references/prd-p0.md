# P0 requirements

- Goal: discover real Ninox tables, IDs, fields, record samples, explicit relationships, inferred relationships, and unknowns.
- Stack: Node.js, TypeScript, Axios, local JSON; Next.js only after the CLI extractor succeeds.
- Order: connection → tables → table → samples → metadata → relationships → JSON → CLI scan → UI.
- Security: GET only; credentials only in `.env.local`; no token in frontend, Git, logs, output, or code.
- Truthfulness: do not invent endpoints or metadata; retain raw responses and use `Unknown`.
- Default record sample: 20.
- Outputs: `schema.json`, `relationships.json`, `scan-summary.json` under `output/`.
- First discovery domain: Shop, following actual relationships around trucks, work orders, jobs, mechanics, parts, and maintenance history without assuming table names.
