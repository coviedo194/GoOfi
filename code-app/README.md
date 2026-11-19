# GoOfi — Code App (para desarrolladores)

Esta carpeta contiene el **código fuente** de GoOfi: una Power Apps Code App construida con **React + TypeScript + Vite** que se conecta a Dataverse.

> Si quieres **instalar y usar GoOfi**, no necesitas este código. Ve a [`../solution/`](../solution/) y descarga el `.zip` desde [Releases](../../releases).

## 🚀 Arrancar el proyecto en local

### Requisitos

- **Node.js ≥ 20** (recomendado LTS).
- **Power Platform CLI (`pac`)** instalado y autenticado en el entorno donde vas a desplegar.
  ```bash
  pac auth create --environment <environmentId>
  ```
- Un entorno de Dataverse con la solución de GoOfi importada (ver [`../solution/`](../solution/)).
- `power.config.json` es local y no se versiona. Créalo desde la plantilla (`Copy-Item power.config.example.json power.config.json`) y pon el ID de tu entorno en `environmentId`. Deja `appId` vacío si aún no tienes la app: `npm run build-push` la crea.

### Pasos

```bash
cd code-app
npm install
npm run dev
```

Por defecto abre `http://localhost:3000`. El valor `localAppUrl` en `power.config.json` controla a qué URL apunta la SDK de Power Apps; ajústalo si cambias el puerto.

## 📜 Scripts npm

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Levanta Vite en modo desarrollo. |
| `npm run build` | Compila TypeScript (`tsc -b`) y genera el bundle de producción en `dist/`. |
| `npm run build-push` | Incrementa el parche de la versión, compila y ejecuta `npx --no-install pa app push` para desplegar en tu entorno. No crea commits ni tags. |
| `npm run build-push-regeneratesolution` | Ejecuta `build-push` y, solo si termina correctamente, regenera la solución usando `GOOFI_PAC_PROFILE` de `.env`. Requiere PowerShell 7+ y `pac`; no crea commits ni tags. |
| `npm run lint` | Pasa ESLint sobre el código. |
| `npm run preview` | Sirve `dist/` para revisión local. |

## 📦 Regenerar la solución

Tras modificar el código (o las entidades / flujos en el entorno), regenera la solución descomprimida en `../solution/package/`:

Configura una vez el archivo `.env` de la raíz del repositorio: copia `.env.example`
como `.env` y rellena `GOOFI_PAC_PROFILE` con el nombre del perfil de `pac auth list`
que apunta al entorno fuente no administrado. `.env` no se versiona y no es necesario
para arrancar Vite.

```bash
pwsh ../solution/scripts/regenerate-solution.ps1
```

> Necesitas PowerShell 7+ (`brew install powershell`) y la CLI de Power Platform autenticada en el entorno.

El script selecciona el perfil configurado en `.env`, exporta la solución `OVIGIGOF` y la descomprime en `../solution/package/`. Si falta la configuración, se detiene con instrucciones. `-PacProfileName <nombre>` permite sobrescribir el perfil; `-PacProfileName ''` usa explícitamente el perfil activo. **La solución descomprimida es de solo lectura** desde el punto de vista del código: se regenera, no se edita a mano. Para publicar una release, ver [`../solution/`](../solution/).

## Indicadores de apertura de oficina

La vista semanal muestra indicadores de apertura a quienes tienen activado
`ovg_permisodeaperturadeoficina` o el rol `GOF-Administradores`, asignado
directamente o mediante un equipo de Dataverse.
Un candado verde junto a cada persona (también junto al propio aviso) indica que
`ovg_permisodeaperturadeoficina` está activado.

La cabecera del día muestra amarillo si no hay avisos y rojo si hay personas
anunciadas pero ninguna puede abrir. Un permiso desactivado o vacío cuenta como
«sin llave». Si no se pueden obtener los datos de algún asistente y no hay una
apertura confirmada, indica «Apertura sin confirmar» en amarillo.
Las leyendas aparecen junto a la fecha y pasan a otra línea solo si falta espacio.
Las cabeceras comparten altura por fila para mantener alineado el contenido de los días.
Solo cuentan los avisos de la oficina y semana visibles, no las inscripciones a eventos.
Si falla la comprobación de acceso, los indicadores se ocultan y aparece un aviso con
opción de reintentar; el resto de la vista sigue disponible. Esta visibilidad en
la interfaz no sustituye los permisos de Dataverse sobre los datos.

## 🌐 Desplegar la Code App

El comando recomendado para compilar, desplegar los cambios de la app y actualizar el snapshot de la solución se ejecuta desde `code-app/`:

```bash
npm run build-push-regeneratesolution
```

Antes de la primera ejecución, asegúrate de haber ejecutado `pac auth create` y de que el `environmentId` de `power.config.json` coincide con tu entorno.

Si necesitas únicamente compilar y desplegar, sin regenerar la solución:

```bash
npm run build-push
```

Para el ciclo completo, comprueba que el perfil activo para el despliegue y el perfil `GOOFI_PAC_PROFILE`
para la exportación apuntan al mismo entorno que `power.config.json`.
Los pasos se encadenan con `&&`: si uno falla, los siguientes
no se ejecutan. La regeneración reemplaza `solution/package/`, por lo que debes
preservar cualquier cambio pendiente allí antes de ejecutarlo. Si solo falla la
regeneración, repite únicamente
`pwsh ../solution/scripts/regenerate-solution.ps1` para no
incrementar otra vez la versión ni volver a desplegar.

### Versión y diagnóstico de la build

La versión de la app empieza en **1.0.0** y tiene una única fuente de verdad:
`package.json`. Vite incorpora esa versión, la fecha de compilación y el commit
corto de Git al bundle, sin reescribir archivos fuente. En el pie de
**Configuración** aparece `v1.0.0`; su tooltip (ratón o foco de teclado) muestra
la fecha y el commit. El sufijo `-dirty` indica que había cambios sin commitear:
en ese caso, el commit es solo la referencia base, no una identificación exacta
del código compilado. En desarrollo, la fecha corresponde al inicio de Vite.

`npm run build` no incrementa la versión. `npm run build-push` la incrementa antes
de compilar: desde `1.0.0`, el siguiente despliegue será `1.0.1`. También actualiza
`package-lock.json`. Si falla la compilación o la subida, la versión incrementada
permanece en los manifiestos; para reintentar sin otro incremento:

```bash
npm run build && npx --no-install pa app push
```

Para publicar la primera versión **1.0.0**, usa igualmente ese comando, sin pasar
por el incremento automático. Para cambiar manualmente una versión funcional o
mayor, usa `npm version minor --no-git-tag-version` o
`npm version major --no-git-tag-version` y luego el mismo comando sin incremento.
La versión de la app es independiente de la versión de cuatro segmentos de la
solución Dataverse, que sube sola en Dataverse al desplegar.

## 🗂 Estructura de la carpeta

```
code-app/
├── package.json
├── power.config.example.json ← plantilla de power.config.json (local, no versionado)
├── vite.config.ts
├── tsconfig*.json
├── eslint.config.js
├── index.html
├── public/                   ← assets estáticos servidos por Vite
├── src/
│   ├── App.tsx               ← punto de entrada de la UI
│   ├── main.tsx              ← bootstrap React
│   ├── components/           ← componentes de UI (WeekView, MiniCalendar, dialogs...)
│   ├── generated/            ← modelos y servicios Dataverse (autogenerados, no editar)
│   ├── hooks/                ← hooks propios (useThemePreference)
│   └── utils/                ← helpers (dateUtils, etc.)
```

> Las instrucciones para agentes de IA están en el [`AGENTS.md`](../AGENTS.md) de la raíz del repo.

> El script para regenerar la solución ya no vive aquí: está en
> [`../solution/scripts/regenerate-solution.ps1`](../solution/scripts/regenerate-solution.ps1).

## 🤝 Contribuir

1. Haz fork del repo.
2. Crea una rama desde `master`: `git checkout -b feat/mi-mejora`.
3. Modifica el código bajo `src/`.
4. Si tocas tablas, flujos o la propia solución, regenera con `../solution/scripts/regenerate-solution.ps1`.
5. Verifica: `npm run lint && npm run build`.
6. Abre un Pull Request describiendo el cambio y enlazando cualquier issue relacionado.

> No hace falta que regeneres la solución para un PR puramente de UI, pero sí si el cambio afecta a esquema, flujos o componentes Dataverse.

## 📚 Modelo de datos (resumen)

Las tablas personalizadas viven en Dataverse y se exponen al frontend como data sources en `power.config.json`:

| Tabla | Logical name | Para qué |
|-------|--------------|----------|
| Oficina | `ovg_oficinaparagof` | Lista de oficinas disponibles. |
| Aviso | `ovg_avisodegof` | Avisos de visita a la oficina. |
| Evento | `ovg_eventoparagof` | Eventos programados. |
| Asistente | `ovg_asistentedeeventoparagof` | Asistentes a eventos. |

Para más detalle (columnas, relaciones, tipos) lee [`AGENTS.md`](../AGENTS.md).

## 🔗 Más

- [`AGENTS.md`](../AGENTS.md) — instrucciones para agentes de IA (único archivo de instrucciones del repo).
- [`../solution/README.md`](../solution/README.md) — guía de instalación para el usuario final.
- [`../docs/FUTURE_AUTOMATIONS.md`](../docs/FUTURE_AUTOMATIONS.md) — automatizaciones pendientes.
