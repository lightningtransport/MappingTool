# Ninox Data Mapper — P0 contract

Ninox Data Mapper is an internal discovery tool that maps an existing Ninox database without modifying it. P0 must answer whether the API exposes enough real information to understand tables, fields, records, and relationships.

## Required order

1. Node.js and TypeScript project
2. Axios-based Ninox client
3. Connection test
4. Discover tables
5. Inspect one table
6. Sample 20 records by default
7. Inspect metadata
8. Discover declared and inferred relationships
9. Generate JSON files
10. Implement `npm run scan`
11. Build the Next.js interface

## Safety and truthfulness

- Use GET only.
- Keep credentials in `.env.local` and out of frontend, Git, logs, and generated output.
- Never invent unavailable metadata. Store raw responses, use `Unknown`, and continue when possible.
- Treat inferred relationships as hypotheses with confidence, never as confirmed Ninox relations.

## P0 outputs

Write `output/schema.json`, `output/relationships.json`, and `output/scan-summary.json`. Numbers must come from the live scan. The first business area to trace is Shop, discovering actual table names around trucks, work orders, jobs, mechanics, parts, and maintenance history.
