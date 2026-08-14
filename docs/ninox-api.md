# Referencia Ninox Private Cloud API

Esta referencia describe la API `/v1` que utiliza realmente Ninox Data Mapper. La fuente primaria es la documentación oficial del foro para [Private Cloud/On-Premises](https://forum.ninox.com/t/x2yzfmf/api-endpoints-for-private-cloudon-premises), complementada por [Tables, fields, and records](https://forum.ninox.com/t/x2yzljq/tables-fields-and-records) y la [categoría API](https://forum.ninox.com/category/api).

## Configuración y autenticación

La raíz se configura con `NINOX_BASE_URL` y debe terminar en `/v1`. Cada solicitud utiliza un token Bearer enviado en el encabezado `Authorization`. El token, el dominio privado y los IDs reales se cargan desde `.env.local` y nunca se registran ni se incluyen en artefactos.

El acceso al schema de Private Cloud requiere una API key con rol Admin. El nombre histórico `team` de las rutas corresponde al workspace de Ninox.

## GET utilizados actualmente

El cliente de producción implementa únicamente estos cuatro accesos:

| Endpoint | Uso |
| --- | --- |
| `GET /teams/{teamId}/databases/{databaseId}` | Schema general y prueba de conexión. |
| `GET /teams/{teamId}/databases/{databaseId}/tables` | Catálogo de tablas. |
| `GET /teams/{teamId}/databases/{databaseId}/tables/{tableId}` | Metadata de una tabla y sus campos. |
| `GET /teams/{teamId}/databases/{databaseId}/tables/{tableId}/records` | Muestra de registros; el límite de 20 se aplica localmente. |

No existe en el cliente un método HTTP genérico público. Todas las rutas se construyen a partir de segmentos codificados.

## GET aprobados pero no utilizados por el flujo actual

Estos endpoints pertenecen a la frontera read-only ya aprobada, pero el cliente de producción todavía no expone un método para llamarlos:

- `GET /teams/{teamId}/databases`
- `GET /teams/{teamId}/databases/{databaseId}/tables/{tableId}/records/{recordId}`

## GET documentados como candidatos

El foro oficial también describe los siguientes recursos GET. Son oportunidades de investigación futura, no capacidades implementadas ni aprobadas automáticamente:

- `GET /teams` y `GET /teams/{teamId}` para workspaces.
- `GET /teams/{teamId}/databases/{databaseId}/views` para metadata de vistas de la base.
- `GET /teams/{teamId}/databases/{databaseId}/query` para consultas que Ninox clasifica como read-only.
- Vistas de tabla y lectura de shared views.
- Cambios de base, tabla o registro mediante sequence number.
- Descarga de archivos, thumbnails y metadata de archivos.

Antes de incorporar cualquiera de ellos se debe verificar la respuesta real de nuestra versión, definir un contrato seguro y añadirlo explícitamente a la lista aprobada.

## Parámetros de lectura de registros

La documentación oficial enumera estos parámetros para controlar consultas y lecturas de registros:

| Parámetro | Propósito documentado |
| --- | --- |
| `query` | Script Ninox que se ejecutará. No se utiliza en el mapper. |
| `filters` | Criterios como JSON serializado. |
| `page` | Página del conjunto de resultados; valor inicial documentado: `0`. |
| `perPage` | Registros por página; valor por defecto `100`. La referencia muestra `250` como valor de ejemplo aceptado, pero no declara un máximo formal. |
| `order` | Campo por el que se ordena. |
| `desc` | Orden descendente. |
| `new` | Registros más nuevos primero; no se combina con `order`. |
| `updated` | Actualizaciones más recientes primero; no se combina con `order`. |
| `sinceId` | Solo registros con un ID mayor. |
| `sinceSq` | Solo registros creados o actualizados después de una secuencia de cambios. |
| `ids` | Devuelve campos usando IDs o nombres. |
| `choiceStyle` | Devuelve choices como IDs o captions. |

Aunque estos parámetros están documentados, el scanner actual no los envía. Solicita el endpoint de registros sin parámetros y conserva localmente hasta `NINOX_SAMPLE_LIMIT` registros. Cambiar esta conducta requiere verificación en vivo y pruebas específicas.

## Métodos prohibidos

Ninox documenta operaciones de escritura y, en algunos casos, una consulta POST denominada read-only. Este proyecto prohíbe todos los métodos distintos de GET, independientemente de la descripción de la operación:

- `POST` para consultas, shared views, creación, actualización masiva o upsert de registros.
- `PUT` para actualizar registros.
- `DELETE` para registros, vistas compartidas o archivos.
- Cargas de archivos y ejecución de consultas mutables.

Esta frontera se aplica tanto al cliente como a scripts, Server Actions, agentes y pruebas en vivo.

## API pública Ninox 4

La [documentación nueva de Ninox API](https://docs.ninox.com/ninox-api) describe recursos `/api/v1/workspace/...` autenticados con una Workspace API Key. Esa API pública no es intercambiable con las rutas Private Cloud `/v1/teams/...` de este proyecto y se conserva únicamente como referencia comparativa.

## Fuentes oficiales

- [Documentación general del foro](https://forum.ninox.com/category/docs)
- [API endpoints for Private Cloud/On-Premises](https://forum.ninox.com/t/x2yzfmf/api-endpoints-for-private-cloudon-premises)
- [Tables, fields, and records](https://forum.ninox.com/t/x2yzljq/tables-fields-and-records)
- [API category](https://forum.ninox.com/category/api)
- [Ninox API 4](https://docs.ninox.com/ninox-api), solo como referencia secundaria
