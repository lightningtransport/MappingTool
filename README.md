# Ninox Data Mapper

Herramienta local y de solo lectura para descubrir, auditar y documentar la estructura de una base de datos Ninox Private Cloud. El mapper convierte metadata real de Ninox en artefactos JSON y en un explorador web, sin modificar la base de datos.

## Estado del proyecto

- **P0 cerrado:** descubrimiento de tablas y campos, relaciones `ref`/`rev`, muestreo, reporte de calidad, grafo de relaciones y reescaneo local seguro.
- **P1.2 completado:** catálogo técnico con anotaciones persistentes, revisión de relaciones, consumidores, candidatos externos, búsqueda global y exportación segura.
- **P2 fuera del alcance actual:** diseño PostgreSQL/Supabase, generación SQL y migración de registros.

El estado verificable más reciente se mantiene en [`docs/p1-status.md`](docs/p1-status.md). Los archivos generados bajo `output/` son locales y están excluidos de Git.

## Seguridad

La integración con Ninox es estrictamente **GET-only**:

- el cliente HTTP solo expone y ejecuta `GET`;
- no se permiten `POST`, `PUT`, `PATCH`, `DELETE`, consultas mutables ni cargas de archivos;
- las credenciales viven únicamente en `.env.local`;
- tokens y encabezados `Authorization` no deben aparecer en logs, frontend, documentación ni artefactos;
- metadata ausente se muestra como `Unknown`; una hipótesis nunca se presenta como relación confirmada.

Consulta [`docs/ninox-api.md`](docs/ninox-api.md) para conocer la frontera exacta de la API y sus fuentes oficiales.

## Requisitos e instalación

- Node.js 22 o superior.
- Acceso de administrador a la metadata de la base Ninox Private Cloud.
- Token API, Team ID y Database ID válidos.

```sh
npm install
cp .env.local.example .env.local
```

Completa `.env.local` localmente:

```dotenv
NINOX_BASE_URL=https://your-private-cloud.ninoxdb.com/v1
NINOX_TOKEN=
NINOX_TEAM_ID=
NINOX_DATABASE_ID=
NINOX_SAMPLE_LIMIT=20
NINOX_TIMEOUT_MS=20000
```

`.env.local` está ignorado por Git. No copies sus valores en comandos, capturas, issues o documentación.

Si conservas las credenciales en el archivo histórico con etiquetas `API`, `Workspace` y `DB id`, puedes importarlas sin versionar el dominio:

```sh
NINOX_BASE_URL="https://your-private-cloud.ninoxdb.com/v1" \
  npm run import:env -- "/absolute/path/to/Ninox api.md"
```

El importador exige HTTPS, crea `.env.local` con permisos restringidos y se niega a reemplazarlo salvo que se indique `--force` de forma explícita.

## Uso

### Verificar y escanear

```sh
npm run test:connection
npm run scan
```

El scan inspecciona las tablas, obtiene hasta 20 registros por tabla para análisis local, genera relaciones y calidad, y conserva un snapshot estructural. La muestra se limita localmente en la implementación actual.

### Abrir el explorador

```sh
npm run dev
```

Después abre [http://127.0.0.1:3000](http://127.0.0.1:3000). La interfaz permite navegar todas las tablas, documentar su significado y uso, revisar campos y relaciones, registrar consumidores, aprobar propuestas externas, buscar en todo el catálogo y exportar conocimiento seguro.

### Importar propuestas de `data-reporting-kit`

La importación solo acepta mapeos Ninox explícitos por ID. Primero revisa el resultado sin escribir y luego importa candidatos pendientes:

```sh
npm run catalog:import -- --path /absolute/path/to/data-reporting-kit --dry-run
npm run catalog:import -- --path /absolute/path/to/data-reporting-kit
```

Los candidatos no se convierten en conocimiento revisado hasta que una persona los acepte en **Usage & Review**. Repetir el comando conserva decisiones si el archivo fuente no cambió.

### Comandos principales

| Comando | Función |
| --- | --- |
| `npm run scan` | Ejecuta el escaneo completo y actualiza los artefactos locales. |
| `npm run discover:tables` | Descubre el catálogo de tablas. |
| `npm run inspect:metadata` | Inspecciona metadata estructural. |
| `npm run discover:relationships` | Regenera las relaciones declaradas y detectadas. |
| `npm run quality:report` | Regenera el reporte de calidad desde evidencia local. |
| `npm run diagnose:unresolved -- UC` | Revisa una referencia no resuelta usando solo GET aprobados. |
| `npm run shop:map` | Regenera el filtro histórico del área Shop. |
| `npm run catalog:import -- --path /ruta [--dry-run]` | Importa mapeos explícitos como candidatos externos revisables. |
| `npm run agent:loop -- --task "..." --dry-run` | Muestra el routing de agentes sin ejecutar el trabajo. |
| `npm run typecheck` | Valida TypeScript. |
| `npm test` | Ejecuta las pruebas automatizadas. |
| `npm run build` | Genera el build de producción de Next.js. |

## Arquitectura

```text
Ninox Private Cloud (GET)
          │
          ▼
Cliente y configuración de servidor
          │
          ▼
Scanner ──► schema / samples / relationships / quality / history
          │
          ▼
Catálogo local revisado ◄── candidatos externos explícitos
          │
          ▼
Next.js Server Component ──► explorador local
```

- `src/ninox/`: configuración, cliente GET-only, tipos y sanitización de errores.
- `src/scanner/`: descubrimiento, relaciones, calidad, historial y diagnósticos.
- `src/cli/`: comandos ejecutables desde npm.
- `src/catalog/`: tipos versionados, validación, persistencia atómica, importación y exportación segura.
- `app/`: interfaz Next.js y Server Actions de reescaneo y revisión local.
- `docs/`: contrato, decisiones, evidencia y referencias técnicas.
- `.agents/`: skill y workflow Coordinator → Builder → Verifier.

## Artefactos locales

El scan escribe, entre otros:

- `output/schema.json`
- `output/relationships.json`
- `output/scan-summary.json`
- `output/analysis/data-quality.json`
- `output/analysis/shop-map.json`
- `output/history/latest-snapshot.json`
- `output/history/latest-diff.json`
- `output/history/snapshots/*.json`
- `output/samples/*.json`
- `output/review/annotations.json`
- `output/review/exports/catalog.json`
- `output/review/exports/catalog.md`

Las muestras pueden contener datos reales. Todo `output/` permanece fuera de Git y no debe enviarse al frontend salvo mediante transformaciones explícitamente seguras.

## Flujo de agentes

Cada hito comienza con un dry-run. La primera ronda usa **Luna/low**; **Terra/medium** se usa únicamente si el Verifier detecta un fallo de implementación. Los errores de infraestructura no justifican escalar de modelo. **Sol/high** requiere autorización explícita mediante `--final-review`.

Antes de cada commit deben pasar typecheck, tests, build, revisión GET-only y búsqueda de secretos. Las reglas completas están en [`AGENTS.md`](AGENTS.md).
