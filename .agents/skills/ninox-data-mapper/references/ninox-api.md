# Private Cloud API

Load connection values from `.env.local`. Use `NINOX_BASE_URL` as the `/v1` API root and send `Authorization: Bearer <NINOX_TOKEN>` without logging it.

Approved endpoints:

- `GET /teams/{teamId}/databases`
- `GET /teams/{teamId}/databases/{databaseId}`
- `GET /teams/{teamId}/databases/{databaseId}/tables`
- `GET /teams/{teamId}/databases/{databaseId}/tables/{tableId}`
- `GET /teams/{teamId}/databases/{databaseId}/tables/{tableId}/records`
- `GET /teams/{teamId}/databases/{databaseId}/tables/{tableId}/records/{recordId}`

Private Cloud schema access requires an API key with Admin role. Do not add writable queries, record mutation, deletion, or file upload endpoints.
