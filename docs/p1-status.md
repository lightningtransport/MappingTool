# Estado de Ninox Data Mapper P1

Estado verificado: 2026-09-20

## Artefacto actual

Todos los contadores de esta sección provienen del scan local verificado `2026-09-20T01:24:59.734Z`:

- 163 tablas y 5,198 campos.
- 109 relaciones Ninox confirmadas y 3 referencias no resueltas (destino `UC`).
- 94 tablas conectadas y 69 aisladas.
- Mapa Shop 25/25.
- 0 errores de escaneo.
- `scannedAt`: `2026-09-20T01:24:59.734Z`.

Las cifras se reconcilian entre `schema.json`, `relationships.json`, `scan-summary.json`, `data-quality.json` y `latest-snapshot.json`. Un scan posterior puede cambiarlas legítimamente; siempre debe mostrarse su `scannedAt`. El catálogo declarado no incluye el mapeo inválido `Samsara_ID` → `WD.FB`: el kit lo afirma, pero `FB` no existe en Ninox vivo.

## Hitos completados

| Hito | Resultado | Commit |
| --- | --- | --- |
| P0: auditoría de cierre | Evidencia de aceptación registrada. | `594186d` |
| P0: normalización `ref` + `rev` | Relaciones deduplicadas y procedencia preservada. | `93e95e8` |
| P0: reescaneo local seguro | Server Action Node.js, exclusión mutua y errores sanitizados. | `400cdb8` |
| P1: diagnóstico de `UC` | Evidencia GET-only; destino continúa sin resolver. | `addfddb` |
| P1: historial estructural | Snapshots y diffs locales integrados al scan y al explorador. | `9e96b09`, `8291e95` |
| P1 hito 0: workflow | Routing Luna → Terra y reglas P1. | `b56d733` |
| P1 hito 1: inspector | Campos, tipos, opciones y navegación `ref`/`rev`. | `805eaa6` |
| P1.2: catálogo técnico | Anotaciones persistentes, relaciones revisables, consumidores, importación externa, búsqueda y exportación segura. | `8d007ba` |
| P1: Relationship Explorer | Alcances Shop + Reporting kit, overlay declarado y empty-scan sin crash. Fuente de verdad: `config/declared-catalog.json`. | `b15f5be` |

## Referencia no resuelta `UC`

Tres campos `Trailers` apuntan al ID de tabla `UC`, pero ese ID no aparece en el schema ni en el catálogo de 163 tablas. El scan vivo `2026-09-20T01:24:59.734Z` vuelve a registrar esas tres referencias. Un GET directo devuelve `404 Not Found` y no se encontró metadata `rev` procedente de `UC`.

La única conclusión respaldada es `unresolved`. Permanece `Unknown`. No se puede afirmar si la tabla fue eliminada, quedó inaccesible o corresponde a una condición interna de Ninox. La evidencia detallada está en [`p1-uc-diagnostic.md`](p1-uc-diagnostic.md).

## Capacidades disponibles

- Descubrimiento y reescaneo de la base completa.
- Inspector de tablas y campos con IDs, tipos, choices y referencias.
- Lista y grafo SVG de relaciones directas, incluyendo un estado vacío cuando no hay vecinos.
- Filtros por procedencia, dirección, alcance histórico Shop (TrucksDB / `E`) y alcance **Reporting kit** (`E`, `WD`, `Z`, `S`, `DE` según `config/declared-catalog.json`).
- Las join rules del data-reporting-kit se muestran como notas externas; no se convierten en aristas Ninox.
- El overlay declarado distingue `ninox_field`, IDs documentados en prosa (`WD.IA`) y omisiones de extracto (`S.E3`, `S.J3`, `S.K3`).
- `LTL_Shop` está **repo-verified** en `main` @ `0f560c1cafd12463cf95e24904af4f5da821e68d` (`apps/api/prisma/schema.prisma`): runtime `supabase`, vehículo `truckNumber`, fases Work Plan derivadas, cero IDs de tabla Ninox. No se dibujan modelos Prisma ni fases de yard como aristas Ninox.
- El scan CLI y el Rescan regeneran `output/analysis/shop-map.json` junto con schema, relaciones y calidad.
- Artefactos de scan ausentes o ilegibles se muestran como alerta; la página no falla.
- Reporte de calidad con tablas aisladas e hipótesis.
- Historial estructural local y resumen del último cambio.
- Diagnóstico seguro de referencias no resueltas.
- Catálogo técnico persistente identificado exclusivamente por IDs estables.
- Edición local de propósito, grano, claves, criticidad, usos, campos, relaciones y consumidores.
- Conservación y detección visible de anotaciones huérfanas después de rescans.
- Importación idempotente de propuestas externas con hash, versión, fecha y procedencia.
- Búsqueda global de tablas, campos, IDs, contexto humano y consumidores.
- Exportaciones JSON y Markdown sin candidatos, muestras ni valores de registros.

## Límites actuales

- Las fórmulas privadas, permisos, vistas y automatizaciones no se presentan como metadata disponible en P1.
- Las muestras de 20 registros orientan la investigación, pero no demuestran calidad completa.
- El contenido de `output/samples/` puede contener valores reales y nunca debe publicarse.
- La jerarquía visual de Ninox no se convierte en una relación sin evidencia API.
- El mapper no diseña todavía el modelo PostgreSQL/Supabase ni genera SQL.

## P1.2 — estado de importación externa

El `data-reporting-kit` descargado se procesó como fuente externa no confiable:

- versión declarada: `3.2.0`;
- `catalog:import` produjo 51 candidatos a partir de mapeos Ninox explícitos;
- los 51 coinciden con IDs vivos del scan `2026-09-20T01:24:59.734Z`;
- el kit sigue afirmando `Samsara_ID` → `WD.FB`, pero `FB` está ausente en Ninox vivo (afirmación falsa). `Truck_Samsara_Profile` existe como `WD.HK` (choice). No se inventa `FB`; el mapeo se eliminó de `config/declared-catalog.json`;
- 51 decisiones continúan pendientes de revisión humana;
- no se sobrescribieron anotaciones humanas ni se ejecutaron consultas.

## Próximo hito

El siguiente incremento puede añadir catálogo de consultas y linaje avanzado sobre los consumidores ya documentados. Sigue fuera de alcance ejecutar consultas, diseñar Supabase/PostgreSQL o modificar Ninox.
