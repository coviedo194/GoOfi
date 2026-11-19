# GoOfi

**GoOfi** nació como una herramienta hecha por un compañero para sus compañeros. En empresas con **trabajo remoto y oficina opcional**, la pregunta de cada día es: *¿quién va mañana a la ofi?* GoOfi lo resuelve con una vista semanal sencilla, eventos para animar la presencialidad y recordatorios automáticos para que siempre haya alguien que pueda abrir la oficina.

Técnicamente es una **Power Apps Code App** (React + TypeScript + Vite) con su **solución de Dataverse** y flujos de Power Automate.

## ✨ ¿Qué puedes hacer con GoOfi?

### Para todo el equipo (app GoOfi)

- 📅 **Ver quién va a la oficina cada día**: una vista semanal (lunes a viernes) con la lista de personas que han avisado de que irán.
- ✅ **Marcar "Voy"**: con un interruptor por día avisas a los demás de que irás (y lo quitas si cambias de planes).
- 🗓️ **Navegar entre semanas**: flechas, botón "Hoy" y un mini-calendario para saltar a cualquier semana.
- 🍕 **Crear eventos en la oficina**: jueves de pizza, viernes de cañitas, cumpleaños del mes, formaciones, teambuilding… con fecha, hora y descripción.
- 🙋 **Apuntarte a eventos**: ves quién organiza y la lista de asistentes, y te apuntas o desapuntas con un clic.
- ✏️ **Gestionar tus eventos**: solo quien organiza un evento puede editarlo o eliminarlo.
- 🏢 **Elegir tu oficina**: todo (avisos y eventos) se filtra por la oficina que tengas configurada.
- 🔁 **Asistencia automática**: indica qué días sueles ir a la oficina (p. ej. martes y jueves) y GoOfi te apuntará automáticamente. Estos días no determinan cuándo recibes notificaciones.
- 🌗 **Tema claro, oscuro o del sistema**, a tu gusto.

### Para quienes tienen llave y administradores (app GoOfi)

- 🔑 **Ver quién puede abrir**: un candado verde junto a cada persona con permiso de apertura permite identificar quién tiene llave o código.
- ⚠️ **Consultar la cobertura de cada día**: la cabecera muestra una advertencia roja si hay personas anunciadas pero ninguna puede abrir, y amarilla si no hay asistentes o la apertura está sin confirmar.
- Estos indicadores son visibles para quienes tienen activado el permiso de apertura y para quienes tienen el rol `GOF-Administradores`, asignado directamente o mediante un equipo.

Un permiso de apertura desactivado o vacío cuenta como «sin llave».

### Automatizaciones (Power Automate)

- 🤖 **Creación de avisos por reglas** (`GOFCrearavisosxreglas`): cada día laborable genera los avisos de los próximos días según los días fijos de cada persona, sin duplicar los existentes.
- 🔔 **Recordatorio diario por Teams** (`GOFRecordatorioavisos`): a la hora configurada, cada persona recibe quién va el siguiente día laborable, los avisos creados hoy y los eventos previstos.
- 🔑 **Alerta de apertura de oficina**: si para el siguiente día laborable no va nadie, o no va nadie **con permiso para abrir** (llave, código de alarma…), se publica un aviso en el chat de grupo de Teams de esa oficina.

### Para administradores (app *GoOfi - Admin*)

- 🛠️ **Gestionar oficinas**: alta/baja de oficinas, chat de Teams asociado a cada una y si permiten eventos (si no, la sección de Eventos se oculta en la app).
- 🗝️ **Definir quién puede abrir la oficina**: marcar en cada usuario el permiso de apertura (tiene llave/código), que usan los indicadores de la Code App y la alerta de apertura por Teams.
- 👥 **Revisar avisos, eventos y usuarios** desde una app model-driven, con el rol `GOF-Administradores`.

## 🚀 Cómo empezar

Este repo tiene dos partes; entra en la que necesites:

### 👤 Quiero instalar GoOfi en mi entorno

👉 Ve a [`solution/`](./solution/) y sigue su README: importar la solución en Power Platform, asignar los roles `GOF-Usuarios` (y `GOF-Administradores` a quien gestione) y ajustar las variables de entorno.

> 📦 El `.zip` de la solución se publicará en [Releases](../../releases) de GitHub. **Próximamente**: todavía no hay ninguna release publicada.

### 👩‍💻 Quiero entender o mejorar el código

👉 Ve a [`code-app/`](./code-app/) y sigue su README: arrancar en local (`npm install`, `npm run dev`) y compilar, desplegar y regenerar la solución con `npm run build-push-regeneratesolution`, todo desde `code-app/`.

## 🤝 Cómo colaborar

¡Toda ayuda es bienvenida! Puedes:

- 🐞 **Reportar un bug o proponer una idea** abriendo un [issue](../../issues).
- 🔧 **Enviar mejoras** con un Pull Request desde un fork: crea una rama desde `master`, verifica con `npm run lint && npm run build` (desde `code-app/`) y describe el cambio.
- 💬 **Compartir feedback**: si lo usas en tu empresa, cuéntame qué te funciona y qué echas de menos.

> Si tu cambio afecta a tablas, flujos o roles de Dataverse, hazlo en el entorno y regenera `solution/package/` con el script; esa carpeta **no se edita a mano**.

## 🗺️ Mapa rápido del repositorio

```
.
├── README.md                  ← este archivo
├── AGENTS.md                  ← instrucciones para agentes de IA (único archivo de instrucciones)
├── docs/
│   ├── FUTURE_AUTOMATIONS.md  ← automatizaciones pendientes
│   └── lanzamiento-goofi.md   ← guion del vídeo y post de LinkedIn
│
├── solution/                  ← 👤 instalación
│   ├── README.md                 "Cómo instalar GoOfi"
│   ├── package/                  solución descomprimida (solo lectura, se regenera)
│   │   ├── AppModules/           app model-driven "GoOfi - Admin"
│   │   ├── CanvasApps/           paquete de la Code App
│   │   ├── Entities/             tablas (oficina, aviso, evento, asistente, usuario)
│   │   ├── Roles/                GOF-Usuarios, GOF-Administradores
│   │   ├── Workflows/            GOFCrearavisosxreglas, GOFRecordatorioavisos
│   │   └── ...
│   └── scripts/                  regenerate-solution.ps1, pack-solution.ps1
│
└── code-app/                  ← 👩‍💻 desarrollo
    ├── README.md                 "Cómo contribuir"
    ├── package.json
    ├── power.config.json
    └── src/                      components/, hooks/, utils/, generated/
```

## 🔮 Próximos pasos

- 📦 **Publicación automática del `.zip` como Release** (ahora es manual). Ver [docs/FUTURE_AUTOMATIONS.md](./docs/FUTURE_AUTOMATIONS.md).
- Otros pendientes se irán anotando ahí mismo.

## Licencia

GoOfi se distribuye bajo la [licencia MIT](./LICENSE).
Copyright (c) 2026 Carlos Oviedo Gibbons.

Las dependencias y los componentes de terceros conservan sus propias licencias.
