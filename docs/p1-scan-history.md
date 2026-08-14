# P1 structural scan history

## Purpose

Each Ninox scan previously replaced the local artifacts, which made later investigation of removed table IDs such as `UC` impossible. P1 now preserves safe structural snapshots and compares every completed scan with the previous local scan.

## Stored evidence

Snapshots contain only:

- scan timestamp;
- table ID and name;
- field ID, name and type;
- explicit forward and reverse relationship IDs;
- normalized relationship identity, source and confidence.

Snapshots never contain:

- sampled records or field values;
- Ninox formulas, functions, triggers or global code;
- raw database-schema responses;
- Authorization headers, environment values or credentials.

## Files

All history remains local and ignored by Git:

- `output/history/snapshots/<scan timestamp>.json`
- `output/history/latest-snapshot.json`
- `output/history/latest-diff.json`

The previous structural snapshot is archived before the current scan artifacts are overwritten. Snapshot and diff files are written through a temporary file and atomically renamed.

## Diff semantics

Tables are matched by table ID. Fields are matched by table ID plus field ID. Relationships are matched by source table ID, source field ID and target table ID.

The latest diff reports:

- tables added, removed or renamed;
- fields added, removed, renamed or structurally changed;
- relationships added, removed or changed.

A relationship whose destination ID changes is represented as one removed relationship and one added relationship. The first scan with no previous artifacts creates a baseline with zero changes rather than reporting every existing object as new.

## Integration

Both `npm run scan` and the local **Rescan** Server Action use the same history writer. The Relationship Explorer reads `latest-diff.json` in its dynamic Server Component and shows a compact summary of the latest structural comparison.

Ninox access remains GET-only. History generation is entirely local filesystem work after the scanner receives its responses.
