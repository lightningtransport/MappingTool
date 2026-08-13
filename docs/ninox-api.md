# Ninox Private Cloud API reference

Base URL is configured by `NINOX_BASE_URL`; for this project it is a Private Cloud `/v1` endpoint. Authenticate with `Authorization: Bearer <NINOX_TOKEN>`.

Approved read-only endpoints:

- `GET /teams/{teamId}/databases`
- `GET /teams/{teamId}/databases/{databaseId}`
- `GET /teams/{teamId}/databases/{databaseId}/tables`
- `GET /teams/{teamId}/databases/{databaseId}/tables/{tableId}`
- `GET /teams/{teamId}/databases/{databaseId}/tables/{tableId}/records`
- `GET /teams/{teamId}/databases/{databaseId}/tables/{tableId}/records/{recordId}`

Schema endpoints require a Private Cloud API key with the Admin role. The public-cloud endpoint is not interchangeable with the private-cloud domain.

Do not implement writable query, record mutation, deletion, or file upload endpoints.
