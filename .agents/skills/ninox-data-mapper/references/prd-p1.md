# P1 requirements

- Goal: turn the P0 structural scan into a local data dictionary suitable for human review and P2 migration planning.
- Inspector: show every table and field with IDs, types, choice metadata, confirmed references, reverse metadata, and explicit `Unknown` values.
- Reviews: store versioned human annotations under `output/review/`; never present them as Ninox evidence or overwrite them during rescan.
- Profiling: analyze at most 20 sampled records per table; persist aggregate counts only and label every metric `sample-based`.
- Reports: export JSON and Markdown without record values, formulas, credentials, Authorization headers, or other secrets.
- History: retain local snapshots and compare by stable table, field, and relationship IDs.
- Boundary: PostgreSQL/Supabase design, SQL generation, and data migration belong to P2.
