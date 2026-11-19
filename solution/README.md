# GoOfi — Solución para usuario final

Esta carpeta contiene la **solución de Dataverse descomprimida** de GoOfi. Está pensada para quien quiere **instalar y usar GoOfi**, no para quien quiere modificar su código.

## 📦 ¿Dónde está el `.zip` para importar?

El archivo distribuible **no vive en este repositorio**. Se publica como **Release de GitHub** con cada versión que el mantenedor decide distribuir.

👉 **[Ir a la sección de Releases](../../releases)** → descarga el último `GoOfi_<versión>.zip`.

> 📦 También puedes generarlo tú mismo: `pac solution pack --zipfile GoOfi.zip --folder solution/package --packagetype Unmanaged`.

---

## 🚀 Instalación paso a paso

### Requisitos

- Un entorno de **Power Platform** con permisos de **administrador** (o al menos para importar soluciones y asignar roles).
- Que el entorno tenga habilitada la creación de soluciones y tablas personalizadas (lo habitual).
- Una cuenta con licencia de **Microsoft Teams** para las conexiones de los flujos (recordatorios y alertas).
- Una cuenta con buzón de **Microsoft 365 Outlook** para enviar las notificaciones de errores.

### 1. Importar la solución

1. Ve a [make.powerapps.com](https://make.powerapps.com) y selecciona tu entorno.
2. Menú lateral → **Soluciones** → **Importar solución**.
3. Arrastra el `.zip` descargado de la release.
4. En el paso de **conexiones**, crea o selecciona una conexión para cada referencia de conexión:
   - `ovg_GOF_Dataverse` (Microsoft Dataverse)
   - `ovg_GOF_Teams` (Microsoft Teams)
   - `ovg_GOF_Outlook` (Office 365 Outlook)
5. Pulsa **Importar** y espera a que termine (suele tardar 1–2 minutos).
6. Configura las variables de entorno indicadas más abajo y comprueba que quedan **activados** los flujos `(GOF) Notificar error de flujo`, `(GOF) Crear avisos x reglas` y `(GOF) Recordatorio avisos`. El flujo hijo utiliza la conexión `ovg_GOF_Outlook` incorporada, no una conexión proporcionada por quien lo ejecuta.

### 2. Asignar los roles

La solución incluye dos roles de seguridad:

| Rol | Para quién |
|-----|------------|
| `GOF-Usuarios` | Todas las personas que usan la app GoOfi (ver y crear avisos, eventos y asistencias). |
| `GOF-Administradores` | Quien gestione oficinas y permisos de apertura desde la app *GoOfi - Admin*. |

1. Ve a [admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com) → tu entorno → **Configuración** → **Usuarios + permisos** → **Roles de seguridad**.
2. Selecciona el rol → **Agregar personas** y asígnalo a las personas o equipos que correspondan.

### 3. Configurar las oficinas (administradores)

Desde la app model-driven **GoOfi - Admin**:

1. **Crea las oficinas** (`Oficina para GOF`) e indica en cada una:
   - **Permite eventos**: si está en *No*, la sección de Eventos se oculta en la app para esa oficina.
   - **ID de conversación de Teams** (`ovg_idconversacionteams`): el ID del chat de grupo de esa oficina, donde se publica la alerta cuando el siguiente día laborable no va nadie que pueda abrir.
2. **Marca quién puede abrir la oficina**: en cada usuario, activa el **permiso de apertura** (`ovg_permisodeaperturadeoficina`) si tiene llave, código de alarma, etc.

> 💡 Para obtener el ID del chat de Teams, abre el chat en Teams web: es el valor que empieza por `19:` en la URL.

### 4. Publicar la Code App

La solución incluye el paquete de la Code App. Tras importarla:

1. En **Soluciones** → abre `GoOfi` → **Aplicaciones de lienzo** → `ovg_gooficodeapp_...`.
2. Pulsa **Reproducir** para abrirla. Si pide conexión Dataverse, créala (es la del propio entorno).
3. Comparte el enlace con los usuarios que tengan el rol asignado.
4. Cada persona, al abrir la app por primera vez, elige su oficina en **Configuración ⚙** (y, si quiere, sus días fijos para los avisos automáticos).

### 5. Variables de entorno

La solución define tres variables que conviene ajustar en cada entorno:

| Variable | Para qué sirve |
|----------|----------------|
| `ovg_GOF_UrlCanvasApp` | URL de la app que se incluye en los mensajes de Teams. **Hay que rellenarla** con la URL de reproducción de la app en tu entorno (el valor por defecto es una plantilla). |
| `ovg_GOF_Hora` | Hora (`00`–`23`, con cero delante: `09`) a la que se envía el recordatorio diario por Teams. Por defecto, `17`. |
| `ovg_GOF_EmailNotificacionErrores` | Texto con una o varias direcciones separadas por `;` para recibir los errores de los flujos. No tiene destinatario predeterminado: configura el **valor actual** en cada entorno, por ejemplo `operaciones@example.com;soporte@example.com`. |

Ajustables desde **Soluciones** → `GoOfi` → **Variables de entorno**.

Al cambiar los destinatarios, guarda el flujo `(GOF) Notificar error de flujo` o desactívalo y actívalo para que Power Automate actualice el parámetro de la variable. Los destinatarios de desarrollo no deben utilizarse como valor predeterminado ni incluirse como valor actual en el paquete distribuible.

> ℹ️ La creación automática de avisos (`GOFCrearavisosxreglas`) se ejecuta a una hora fija definida en el propio flujo y no depende de `ovg_GOF_Hora`.

### Notificaciones de errores

Los dos flujos programados mantienen su lógica de negocio dentro de `ScpPrincipal`. Si falla, agota el tiempo de ejecución o se omite por un fallo previo de inicialización, `ScpError` llama al flujo hijo `(GOF) Notificar error de flujo` con `string(workflow())`.

El hijo analiza esos metadatos y envía un correo HTML que identifica **GoOfi**, el flujo y el entorno, con un enlace directo a la ejecución. El enlace utiliza `tags.environmentName`, `tags.logicAppName` y `run.name`; no contiene nombres de clientes ni identificadores de otros entornos fijados en la definición.

El padre termina como **Fallido** tanto si el correo se envía como si falla la notificación. La llamada al hijo no se reintenta automáticamente para evitar repetir la notificación completa. El hijo devuelve una respuesta de error y también termina como fallido si no puede notificar, incluidos los destinatarios vacíos o los metadatos inválidos.

Este mecanismo no sustituye la supervisión de Power Automate: no detecta flujos desactivados, fallos que impiden iniciar una ejecución ni cancelaciones manuales. Si la conexión Outlook no funciona, el fallo queda en el historial pero el correo no puede enviarse.

---

## 📂 ¿Qué hay dentro de esta carpeta?

```
solution/
├── README.md                   ← este archivo
├── package/                    ← solución descomprimida (la fuente de verdad)
│   ├── AppModules/             ← app model-driven "GoOfi - Admin"
│   ├── AppModuleSiteMaps/
│   ├── CanvasApps/             ← paquete de la Code App
│   │   └── ovg_gooficodeapp_..._CodeAppPackages/
│   ├── Entities/               ← tablas Dataverse personalizadas
│   │   ├── ovg_asistentedeeventoparagof/   (Asistente de evento)
│   │   ├── ovg_avisodegof/                  (Aviso)
│   │   ├── ovg_eventoparagof/               (Evento)
│   │   └── ovg_oficinaparagof/              (Oficina)
│   ├── environmentvariabledefinitions/     ← variables de entorno
│   ├── Other/                  ← relaciones, customizations.xml, Solution.xml (versión)
│   ├── Roles/                  ← GOF-Usuarios, GOF-Administradores
│   ├── WebResources/           ← iconos, imágenes
│   └── Workflows/              ← flujos Power Automate
│       ├── GOFCrearavisosxreglas         (crea avisos según reglas)
│       ├── GOFRecordatorioavisos         (recordatorio diario y alerta de apertura por Teams)
│       └── flujo hijo de notificación   (correo de errores de GoOfi)
├── scripts/                    ← scripts de PowerShell para mantener esta carpeta
│   └── regenerate-solution.ps1 ← descarga y desempaqueta desde Dataverse → package/
```

> ⚠️ **No edites los archivos XML a mano dentro de `package/`.** Si quieres modificar algo, hazlo desde el código (`code-app/`) o desde el portal de Maker, y luego ejecuta `pwsh solution/scripts/regenerate-solution.ps1` para volver a traer la solución a `package/`.

---

## ❓ Problemas frecuentes

- **"No tengo permiso para importar soluciones"** → necesitas rol de **Environment Maker** o **System Administrator** en el entorno.
- **"El flujo GOFRecordatorioavisos falla"** → revisa que la variable `ovg_GOF_Hora` tenga un valor válido y que la conexión `ovg_GOF_Teams` esté activa.
- **"No llega el correo de errores"** → revisa el valor actual de `ovg_GOF_EmailNotificacionErrores`, guarda o reactiva el flujo hijo para actualizar su parámetro y comprueba que está activo y que `ovg_GOF_Outlook` tiene una conexión válida. El historial de `ScpError` indica si falla la llamada al hijo.
- **"No llega la alerta de apertura al chat de Teams"** → comprueba que la oficina tiene relleno el **ID de conversación de Teams** y que la cuenta de la conexión de Teams es miembro de ese chat.
- **"La app no carga datos"** → confirma que el usuario tiene el rol `GOF-Usuarios` asignado, que la conexión Dataverse está creada y que ha elegido su oficina en **Configuración ⚙**.
- **"La sección de Eventos no aparece"** → comprueba que la oficina del usuario tiene **Permite eventos** = *Sí* (`ovg_permiteeventos`).

---

## Para desarrolladores

Si quieres modificar el código, ve a [`../code-app/`](../code-app/).

Si quieres entender cómo se mantiene esta solución:

- [`./scripts/regenerate-solution.ps1`](./scripts/regenerate-solution.ps1) — descarga la solución desde Dataverse y la desempaqueta en `package/`.
- Releases: se publican a mano. Con la solución ya regenerada y en `master`, lanza la GitHub Action «Release de la solución» desde la pestaña Actions («Run workflow») o con `gh workflow run release-solution.yml`. Empaqueta `solution/package/` y crea la release `vX.X.X.X` con `GoOfi_X.X.X.X.zip`, usando la versión de `Solution.xml` (sube sola en Dataverse al desplegar). Si esa versión ya está publicada, no hace nada.

El script se invoca desde la raíz del repo:

Para regenerar, copia `.env.example` como `.env` en la raíz y configura
`GOOFI_PAC_PROFILE` con el nombre del perfil PAC del entorno fuente no administrado
(`pac auth list`). El script selecciona ese perfil; si falta el archivo o el valor,
se detiene antes de invocar PAC. `.env` está ignorado por Git.
`-PacProfileName <nombre>` sobrescribe la configuración y `-PacProfileName ''`
usa explícitamente el perfil activo.

```powershell
pwsh solution/scripts/regenerate-solution.ps1   # bajar cambios desde Dataverse
