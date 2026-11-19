# Instrucciones para agentes - GoOfi

Este es el **único** archivo de instrucciones del repositorio (válido para cualquier agente/arnés). Contiene contexto del proyecto, reglas del repositorio y flujo de trabajo.

## Contexto del proyecto

**GoOfi** es una Power Apps Code App desarrollada con React, TypeScript y Vite que se conecta a Dataverse para coordinar la presencialidad en la oficina entre compañeros de trabajo remotos.

## Estilo de documentación

- Redactar todos los archivos Markdown del repositorio como documentación
  vigente, en presente y como un diseño definido desde cero.
- No incluir historial de desarrollo, errores corregidos, intentos,
  reversiones ni comparativas con estados anteriores.
- Describir qué hace el sistema y cómo está organizado, no el proceso
  seguido para construirlo o modificarlo.
- Mantener explícitas las limitaciones actuales y las mejoras futuras,
  sin presentar capacidades pendientes como implementadas.
- Aplicar esta regla también al README y a las instrucciones para agentes.

## Estructura del repositorio

| Carpeta | Contenido |
|---------|-----------|
| `code-app/` | Código fuente React/Vite/TS y configuración de Power Apps CLI (`power.config.json`). **Es la única carpeta con lógica.** Los comandos `npm`/`pa` se ejecutan desde aquí. Las rutas `src/...` de este documento son relativas a `code-app/`. |
| `solution/` | Solución de Dataverse **descomprimida** en `solution/package/` (snapshot automático) y scripts en `solution/scripts/`. El `.zip` se publica por **GitHub Releases**. |

- `solution/scripts/regenerate-solution.ps1` — descarga la solución desde Dataverse y la desempaqueta en `package/`. Lee el perfil PAC de `.env`; `-PacProfileName` permite sobrescribirlo explícitamente.
- Releases: se publican a mano. Con la solución ya regenerada y en `master`, lanza la GitHub Action «Release de la solución» desde la pestaña Actions («Run workflow») o con `gh workflow run release-solution.yml`. Empaqueta `solution/package/` y crea la release `vX.X.X.X` con `GoOfi_X.X.X.X.zip`, usando la versión de `Solution.xml` (sube sola en Dataverse al desplegar). Si esa versión ya está publicada, no hace nada.
- **No commitear** `node_modules/`, `dist/`, `.playwright-mcp/`, `code-app/power.config.json` (IDs locales; plantilla en `power.config.example.json`) ni archivos `.zip`. `code-app/.power/schemas/` sí se versiona: el código generado lo importa.
- `regenerate-solution.ps1` sustituye en los flujos la URL real de la app y los correos de `defaultValue` por plantillas. No publicar IDs de entorno, app o tenant ni correos del entorno de desarrollo.

## Configuración local para agentes

- Consultar `.env` en la raíz del repositorio para los valores locales de las herramientas. No asumir nombres de perfiles personales ni deducir el entorno fuente a partir del perfil PAC activo.
- `.env` está ignorado por Git; `.env.example` contiene las claves sin valores personales. No guardar contraseñas ni tokens en estos archivos.
- Si falta `.env`, crearlo copiando `.env.example`. Conservar los valores existentes y solicitar al desarrollador únicamente los datos necesarios para la tarea actual; las demás claves pueden quedar vacías.
- Para regenerar la solución se necesita `GOOFI_PAC_PROFILE`: nombre de un perfil de `pac auth list` que apunte al entorno fuente **no administrado**. Si falta o está vacío, solicitarlo antes de ejecutar el script y guardarlo en `.env`.
- El script lee `.env` sin ejecutar su contenido. Acepta valores sin comillas o con comillas simples/dobles y comentarios en líneas separadas; no expande variables ni comandos.
- Usar `pwsh solution/scripts/regenerate-solution.ps1` normalmente. `-PacProfileName` sobrescribe `.env`; pasar `-PacProfileName ''` usa el perfil activo solo cuando el desarrollador lo pide explícitamente.
- Esta configuración es para herramientas locales, no para React ni para sustituir los identificadores de `power.config.json` o del snapshot de Dataverse.

## Sincronización con Dataverse (regla para agentes)

`solution/package/` **SOLO se actualiza con `solution/scripts/regenerate-solution.ps1`**. Cuando el usuario pide un cambio en la solución (tablas, columnas, formularios, flujos, roles…), el agente lo hace **en Dataverse** mediante pac, Web API o MCP, y después se regenera el snapshot. No se edita el XML/JSON de `solution/package/` para empaquetarlo e importarlo (ver el aviso de solo lectura más abajo).

- Cambios hechos por el usuario en el portal Maker → el usuario ejecuta el script.
- Cambios hechos por un agente contra Dataverse (pac/API/MCP, roles, tablas, flujos…) → **avisar al usuario de que hay cambios pendientes**. Si también hay cambios de la app pendientes de desplegar, recomendar `npm run build-push-regeneratesolution` desde `code-app/`; si solo falta actualizar el snapshot, recomendar `pwsh solution/scripts/regenerate-solution.ps1` desde la raíz.

## Flujo de trabajo y recordatorios (solo recordar, no ejecutar sin que lo pida)

1. **Tras cambios en `code-app/`**: recomendar `npm run build-push-regeneratesolution` desde `code-app/` para compilar, desplegar y actualizar `solution/package/` con un solo comando. Este es también el recordatorio predeterminado cuando hay cambios tanto en la app como en Dataverse; no proponer los dos comandos separados para el ciclo completo.
2. **Tras cambios solo en Dataverse o tras un despliegue ya realizado sin regeneración**: recordar ejecutar `pwsh solution/scripts/regenerate-solution.ps1` desde la raíz. No volver a desplegar ni incrementar la versión si solo falta regenerar.
3. **Si el usuario pide o se va a hacer un `git commit`**: antes, recordar el ciclo pendiente según los puntos anteriores (`build-push-regeneratesolution` → commit cuando hay cambios de la app).
4. **Al empezar una sesión**: mirar `git log -1 --format=%cd`. Si pasó **una semana o más** desde el último commit (y hay cambios sin commitear), recordárselo en el chat **una sola vez por sesión**.
5. Nunca hacer commit ni push sin que el usuario lo pida.

Tanto al recomendar el ciclo completo de compilación, despliegue y regeneración como al ejecutarlo con autorización del usuario, usar el script existente desde `code-app/`:

```bash
npm run build-push-regeneratesolution
```

El script incrementa el parche de la app, compila, despliega y regenera `solution/package/` en ese orden; se detiene si falla algún paso. Antes de ejecutarlo, comprobar que `power.config.json` y el perfil indicado por `GOOFI_PAC_PROFILE` en `.env` apuntan al mismo entorno fuente no administrado. No crea commits ni tags ni hace push de Git.

## Gestión de errores de los flujos

- Los flujos programados de GoOfi mantienen la lógica de negocio en `ScpPrincipal`. Las inicializaciones de variables que Power Automate exige en el nivel raíz permanecen fuera del scope.
- `ScpError` se ejecuta cuando `ScpPrincipal` falla, agota el tiempo o queda omitido por un fallo previo. Llama a `(GOF) Notificar error de flujo` con `string(workflow())`, sin reintentar la llamada al hijo, y finaliza como **Fallido** con independencia del resultado de la notificación.
- El hijo usa `ovg_GOF_Outlook` con una conexión incorporada, analiza los metadatos y envía un correo HTML que identifica GoOfi, el flujo, el entorno y la URL de ejecución. Si no puede notificar, responde con error al padre y también termina como fallido.
- `ovg_GOF_EmailNotificacionErrores` es una variable de entorno **de Dataverse**, de tipo texto, con direcciones separadas por `;`. No pertenece al `.env` local. Solicitar el destinatario necesario para cada entorno; no fijar correos personales como valor predeterminado ni distribuir el valor actual de desarrollo.
- Al cambiar su valor actual, guardar o reactivar el hijo para actualizar el parámetro de Power Automate. Las definiciones, el hijo y las referencias deben formar parte de `OVIGIGOF`; los valores actuales son específicos de cada entorno.
- El patrón no cubre flujos desactivados, fallos del desencadenador que impiden iniciar una ejecución ni cancelaciones manuales. Si Outlook no está disponible, el historial conserva el error, pero no puede enviarse el correo.

## Modelo de datos (Dataverse)

### Tablas personalizadas

| Tabla | Nombre lógico | Descripción |
|-------|---------------|-------------|
| Oficina | `ovg_oficinaparagof` | Lista de oficinas disponibles |
| Aviso | `ovg_avisodegof` | Avisos de visita a la oficina |
| Evento | `ovg_eventoparagof` | Eventos programados en la oficina |
| Asistente | `ovg_asistentedeeventoparagof` | Registro de asistentes a eventos |

### Campos clave

**Oficina (`ovg_oficinaparagof`):**
- `ovg_nombre` (string) - Nombre de la oficina
- `ovg_permiteeventos` (bit, OptionSet 0/1, default 1) - Si la oficina permite la sección de Eventos en la app

**Aviso (`ovg_avisodegof`):**
- `ovg_fecha` (date) - Fecha de la visita
- `ovg_oficina` (lookup) - Referencia a oficina
- `ownerid` (owner) - Usuario que creó el aviso
- `ovg_creadomedianteregla` (bit) - Si fue creado automáticamente

**Evento (`ovg_eventoparagof`):**
- `ovg_asunto` (string) - Título del evento
- `ovg_fecha` (datetime) - Fecha/hora de inicio
- `ovg_fechahasta` (datetime) - Fecha/hora de fin (opcional)
- `ovg_oficina` (lookup) - Referencia a oficina
- `ovg_descripcion` (richtext) - Descripción del evento
- `ownerid` (owner) - Organizador

**Usuario (`systemuser`) - campos personalizados:**
- `ovg_oficinaparagof` (lookup) - Oficina asignada al usuario
- `ovg_permisodeaperturadeoficina` (bit) - Puede abrir la oficina. En la vista semanal, las personas con este campo activado o con el rol `GOF-Administradores` (directo o heredado de equipo) ven candados verdes junto a quienes pueden abrir; los días sin avisos aparecen en amarillo y los días con personas pero sin apertura en rojo. Un campo desactivado o vacío cuenta como «sin llave» para un usuario cargado. Si no se pueden obtener los datos de un asistente y no hay una apertura confirmada, se indica como apertura sin confirmar.
- `ovg_diasparaavisosautomaticosengof` (multiselect) - Días para avisos automáticos
  - Valores: Lunes=1, Martes=2, Miércoles=3, Jueves=4, Viernes=5

## Convenciones de código

### Nomenclatura

- **Prefijo de publisher:** `ovg_`
- **Componentes React:** PascalCase (ej: `WeekView`, `EventCard`)
- **Hooks:** camelCase con prefijo `use` (ej: `useAvisos`, `useEventos`)
- **Servicios:** camelCase (ej: `dataverseService.ts`)

### Estructura recomendada

```
src/
├── components/         # Componentes React
│   ├── common/        # Componentes reutilizables
│   ├── events/        # Componentes de eventos
│   ├── notices/       # Componentes de avisos
│   └── settings/      # Componentes de configuración
├── hooks/             # Custom hooks
├── services/          # Servicios de API (Dataverse)
├── types/             # Tipos TypeScript
├── utils/             # Utilidades
└── App.tsx
```

## Guía de desarrollo

### Conexión a Dataverse

Para conectar a Dataverse desde una Code App:
1. Usar el cliente MSAL para autenticación
2. Consumir la Web API de Dataverse
3. El endpoint base es: `{org}.api.crm.dynamics.com/api/data/v9.2/`

### EntitySetNames para queries

```typescript
const ENTITIES = {
  oficinas: 'ovg_oficinaparagofs',
  avisos: 'ovg_avisodegofs',
  eventos: 'ovg_eventoparagofs',
  asistentes: 'ovg_asistentedeeventoparagofs',
  usuarios: 'systemusers'
};
```

### Filtros comunes

- Avisos de una semana: `$filter=ovg_fecha ge ${startDate} and ovg_fecha le ${endDate}`
- Avisos de una oficina: `$filter=_ovg_oficina_value eq ${oficinaId}`
- Solo registros activos: `$filter=statecode eq 0`

## Estado actual del proyecto

### ✅ Completado
1. **Vista semanal básica** - 5 columnas (Lun-Vie) con navegación (←, →, rango, mini-calendario, "Hoy")
2. **Listar avisos** - Muestra nombres de personas que van cada día
3. **Crear/eliminar avisos** - Toggle Switch "Asistir" / "Voy" compacto por día
4. **Listar eventos** - Cards con hora, organizador y badge de asistentes
5. **Fluent UI integrado** - FluentProvider v9.74.1, webLightTheme
6. **Ver detalle de evento** - Modal con asunto, descripción (rich text), fecha/hora, duración, oficina y lista de asistentes
7. **Crear/editar eventos** - `EventFormDialog` con validación y preselección de fecha desde el botón "+" del día
8. **Eliminar eventos** - Sólo el organizador (badge "Organizador" en el modal)
9. **Gestión de asistencia a eventos** - Switch "Asistir" en la tarjeta del evento (mismo predicado `soyOrganizador`) y switch en el modal de detalle
10. **Botón lápiz sólo para el organizador** - En la tarjeta del evento, evita confusión con el switch de asistencia
11. **Bandera `ovg_permiteeventos` por oficina** - Si la oficina del usuario tiene el flag a 0, se oculta toda la sección de Eventos (título, separador, tarjetas, botón "+") y se salta la query de eventos y asistentes
12. **Filtro y configuración de oficina** - Avisos y eventos sólo se consultan después de confirmar una oficina y se filtran por `_ovg_oficina_value eq ${userOfficeId}`. Al abrir la app sin oficina configurada se pide al usuario que la seleccione y se explica que vaciarla detiene las notificaciones; si no hay oficinas activas, se le indica que contacte con el administrador.
13. **Modal de Configuraciones** - `SettingsDialog` con dos campos:
    - **Oficina para GOF:** dropdown single (lista `ovg_oficinaparagofs` activas), con opción para vaciar la selección
    - **Días para avisos automáticos en GOF:** dropdown multiselect (Lun-Vie)
    - Autoguardado al cambiar (sin botón "Guardar"); en caso de error se revierte y se muestra `MessageBar`. Al cambiar la oficina se recarga también el flag `ovg_permiteeventos` para mantener coherente la sección de Eventos.
    - Botón ⚙ en el header (`SettingsRegular`).
    - Versión de `code-app/package.json` visible en el pie de Configuración, con fecha y commit en el tooltip. `build-push` incrementa el parche sin crear commits ni tags.
14. **Avisos automáticos (campo)** - El campo `ovg_diasparaavisosautomaticosengof` se lee al iniciar sesión y se persiste desde el modal. El flujo Power Automate (`GOFCrearavisosxreglas`) ya consume el campo; sólo faltaba la UI.

### 🚧 Pendiente (Roadmap)
1. **Avisos automáticos (flujo)** - Validar que el flujo Power Automate existente (`GOFCrearavisosxreglas`) reacciona correctamente cuando el usuario cambia los días desde la UI y crea avisos con `ovg_creadomedianteregla = true` en las fechas esperadas.
2. **Notificaciones / recordatorios** - Evaluar el segundo flujo (`GOFRecordatorioavisos`) y si conviene exponer algún ajuste desde la app.

## Lecciones aprendidas (Sesión 1)

### Campos polimórficos (owner)
El campo `ownerid` en Dataverse es **polimórfico** (puede ser User o Team). 
- ❌ `owneridname` NO se devuelve en queries OData
- ✅ Usar `_owninguser_value` para obtener el ID del usuario
- ✅ Consultar `systemusers` por separado para obtener `fullname`

### Servicios generados
Al ejecutar `pa app add data-source --connector dataverse --table <tabla>`:
- Se genera `src/generated/models/<Tabla>Model.ts` (tipos TypeScript)
- Se genera `src/generated/services/<Tabla>Service.ts` (CRUD)
- El comando usa el nombre **singular** de la tabla (no el EntitySetName)

### Lookups en creación
Para crear un registro con lookup:
```typescript
{
  ovg_fecha: '2026-01-15',
  'ovg_oficina@odata.bind': `/ovg_oficinaparagofs(${oficinaId})`,
}
```

### Bandera `ovg_permiteeventos` en oficina
El campo `ovg_permiteeventos` (bit, default 1) controla si la oficina expone la sección
de Eventos. Si vale `false`:
- Se oculta toda la sección (título, tarjetas, botón `+`).
- Se oculta también el separador y el título "Personas que van a la Ofi" para
  que la columna no quede con un título redundante como único contenido.
- En `loadWeekData` se saltan las queries a `ovg_eventoparagofs` y
  `ovg_asistentedeeventoparagofs`.

Si la oficina está configurada pero no se puede leer el campo, se asume `true` para mantener la UX. Sin oficina configurada no se consultan avisos ni eventos; se solicita al usuario que seleccione una antes de empezar.

### Campos bit de Dataverse
Para un campo `bit`, Dataverse devuelve `true`/`false` (no `1`/`0`). Por eso en
`WeekView` se valida con `rawFlag === true || rawFlag === 1`.

### Limpiar un lookup desde Web API
Para asignar un lookup:
```typescript
{ 'ovg_oficinaparagof@odata.bind': `/ovg_oficinaparagofs(${id})` }
```
Para **dejarlo en null** (quitar la asignación):
```typescript
{ 'ovg_oficinaparagof@odata.bind': null }
```
`_ovg_oficinaparagof_value` es de solo lectura y no sirve para vaciar. `SystemusersBase`
sólo tipa el `@odata.bind` como string, así que para vaciar hay que hacer una aserción
a `Record<string, unknown>` (mismo patrón que se usa ya para el bit `ovg_permiteeventos`).

### Privilegios del rol `GOF-Usuarios`
Crear registros con lookups (`@odata.bind`) exige **Append** en la tabla origen y
**AppendTo** en la tabla destino. El rol incluye Append en aviso, evento, asistente y
User, y AppendTo en oficina y evento. Si se añaden tablas o lookups nuevos, revisar el rol.

### Multiselect picklists (auto-serialización)
`SystemusersService` aplica `serializeMultiSelectPicklistFields` /
`deserializeMultiSelectPicklistFields` a `ovg_diasparaavisosautomaticosengof`.
En TypeScript el campo es un array de keys numéricas (`(1|2|3|4|5)[]`); al
escribir basta con enviar el array de números, el servicio lo serializa al
formato correcto. Al leer, `deserializeMultiSelectPicklistFields` lo deja como
`number[]`, así que `Number(d)` es un no-op defensivo si el runtime alguna
vez lo entregara como string.

### `solution/package/` es **sólo lectura**
La carpeta `solution/package/` se regenera con `solution/scripts/regenerate-solution.ps1`.
No la edites a mano: cualquier cambio se perderá en la siguiente exportación.
Para el detalle completo de qué hacer y qué **no** hacer, ver la sección
"⚠️ `solution/package/` es SOLO LECTURA" más abajo.


## Notas importantes

- Los avisos usan `ovg_fecha` como **date only** (sin hora)
- Los eventos usan `ovg_fecha` como **datetime** (con hora)
- El `ownerid` se usa para identificar quién creó avisos/eventos y quién asiste
- La oficina filtra todo: solo se ven avisos/eventos de la misma oficina del usuario
- Los asistentes a eventos se guardan en tabla separada (`ovg_asistentedeeventoparagof`)

## Estructura actual del proyecto

```
src/
├── main.tsx                  # Punto de entrada
├── App.tsx                   # FluentProvider + WeekView
├── components/
│   ├── WeekView.tsx          # ⭐ Componente principal (vista semanal)
│   ├── WeekView.css
│   ├── EventDetailDialog.tsx # Modal de detalle de evento
│   ├── EventDetailDialog.css
│   ├── EventFormDialog.tsx   # Formulario crear/editar evento
│   ├── EventFormDialog.css
│   ├── MiniCalendar.tsx      # Mini-calendario en popover para navegar a otra semana
│   ├── MiniCalendar.css
│   ├── SettingsDialog.tsx    # Modal de Configuraciones (oficina + días)
│   └── SettingsDialog.css
├── utils/
│   └── dateUtils.ts          # Funciones de fecha
└── generated/                # Auto-generado por pa (power-apps-cli) (NO editar)
    ├── models/               # Tipos TypeScript
    └── services/             # Servicios CRUD
```

> **Nota:** los archivos bajo `src/generated/` son autogenerados. Si añades campos
> nuevos en Dataverse (p. ej. `ovg_permiteeventos`), re-ejecuta
> `pa app add data-source --connector dataverse --table <tabla>` para regenerar tipos y servicios.

## Herramientas de Dataverse

### `solution/scripts/regenerate-solution.ps1`

Script de **PowerShell 7+** que automatiza: seleccionar perfil PAC → exportar la solución OVIGIGOF como no administrada → descomprimir el ZIP → borrar el ZIP temporal.

```bash
pwsh solution/scripts/regenerate-solution.ps1
```

- Perfil predeterminado: `GOOFI_PAC_PROFILE` de `.env` en la raíz del repo. Si falta el archivo o el valor, el script se detiene antes de invocar PAC y explica cómo configurarlo.
- Parámetros: `-PacProfileName` (sobrescribe `.env`; `''` usa explícitamente el perfil activo), `-SolutionName` (default `OVIGIGOF`)
- Salidas: `solution/solution.zip` (temporal) y `solution/package/` (permanente, solo lectura)
- Resuelve rutas con `$PSScriptRoot`, así que funciona desde cualquier cwd
- Requiere `pwsh` y la [Power Platform CLI](https://learn.microsoft.com/power-platform/developer/cli/introduction) en el PATH

El script **no es idempotente**: cada ejecución borra `solution/package/` antes de regenerarlo. Si hay cambios sin commitear ahí, se pierden.


> **⚠️ `solution/package/` es SOLO LECTURA — nunca escribir ahí**
>
> La carpeta `solution/package/` es un *snapshot* exportado y desempacado de la
> solución Dataverse (`OVIGIGOF`). **Cualquier edición manual será sobrescrita
> en la siguiente ejecución de `regenerate-solution.ps1`.**
>
> Reglas:
> - ❌ **NO** usar `solution/package/` como vía para cambiar la solución:
>   no editar `Entities/`, `CanvasApps/`, `Workflows/`, `WebResources/`,
>   `Other/`, `Roles/`, etc. para luego empaquetar e importar. Los cambios se
>   hacen en Dataverse (pac, Web API o MCP) y se traen con el script.
> - ✅ Los cambios que produce `regenerate-solution.ps1` (exportación y limpieza
>   de IDs y correos en los flujos) son legítimos y se commitean; no revertirlos.
>   Solo revertir con `git checkout -- solution/package/` lo que un agente haya
>   editado a mano por error.
> - ✅ **SÍ** leer esos archivos para entender el modelo de datos, los flujos,
>   o la configuración de la solución.
> - ✅ **SÍ** regenerar la carpeta ejecutando `pwsh solution/scripts/regenerate-solution.ps1`
>   cuando necesites una vista actualizada.
>
> Para cambiar algo de la solución (tablas, columnas, flujos, web resources,
> etc.) hazlo en el entorno Dataverse / Power Apps, **no** editando
> `solution/package/`.

## Recursos

- [Power Apps Code Apps Docs](https://learn.microsoft.com/power-apps/maker/code-apps/)
- [Dataverse Web API](https://learn.microsoft.com/power-apps/developer/data-platform/webapi/overview)
- [Fluent UI React](https://react.fluentui.dev/)
