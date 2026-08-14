# P1 unresolved table diagnostic: UC

Diagnostic date: 2026-08-14

## Result

`UC` remains unresolved after a live, GET-only metadata diagnostic.

Independent evidence:

- The database-level schema is an object with `settings` and `schema` roots.
- Table definitions are stored under the `schema.types` map, which contains 163 IDs.
- `schema.types` does not contain the key `UC`.
- The `/tables` catalog contains the same 163 tables and does not contain `UC`.
- A direct request to the approved `GET /tables/UC` endpoint returns `404 Not Found`.
- Three forward `ref` fields point to `UC`.
- No inspected `rev` field declares `referenceFromTable: UC`.
- All 163 catalogued tables were inspected without errors.

The evidence supports only the status `unresolved`. It does not distinguish between a deleted table, an inaccessible historical table or another Ninox-internal condition.

## Forward references

| Source table | Table ID | Field | Field ID | Target ID |
| --- | --- | --- | --- | --- |
| Repairs_Record | `V` | Trailers | `J4` | `UC` |
| Repair Records | `PH` | Trailers | `J6` | `UC` |
| Trailers_Repair_ | `BI` | Trailers | `M` | `UC` |

## Reproduction

```sh
npm run diagnose:unresolved -- UC
```

The command writes `output/analysis/unresolved-UC.json`. The file is local and ignored by Git.

The diagnostic uses only:

- `GET /teams/{teamId}/databases/{databaseId}`
- `GET /teams/{teamId}/databases/{databaseId}/tables`
- `GET /teams/{teamId}/databases/{databaseId}/tables/{tableId}`

It does not query records or call a write endpoint.

## Security boundary

The database-level schema can contain executable Ninox code with embedded third-party credentials. The diagnostic therefore does not persist raw schema, formulas or code values. It stores only response shape, structural key names, table counts, safe table summaries and relationship-specific metadata.

Automated tests verify that bearer-like values in schema code and request errors do not appear in the serialized diagnostic.

## Next P1 work

Add scan-to-scan structural diffs for table IDs and relationship keys. A historical diff is the remaining evidence-based way to determine when `UC` disappeared or whether a future scan makes it available again.
