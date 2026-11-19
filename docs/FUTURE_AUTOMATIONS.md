# FUTURE_AUTOMATIONS

Lista viva de automatizaciones pendientes para el repositorio. Cada entrada describe **qué falta**, **por qué importa** y, cuando aplica, **un esbozo de cómo implementarlo**.

---

## 🧹 Identificadores del entorno

Hecho al publicar el repositorio: `code-app/power.config.json` es local (plantilla en
`power.config.example.json`) y `regenerate-solution.ps1` sustituye en los flujos la URL real
de la app y los correos de `defaultValue` por plantillas. Pendiente:

- [ ] Crear un entorno Dataverse «plantilla» para exportar sin datos propios del mantenedor
      (por ejemplo, el bloque `<Publisher>` de `solution/package/Other/Solution.xml`).
- [ ] Comprobar tras cada exportación que no aparecen GUIDs de entorno, app o tenant.

---

## Otros pendientes

_(añadir aquí otras automatizaciones que surjan)_

- [ ] CI que ejecute `npm run lint && npm run build` en cada PR a `master`.
- [ ] Pre-commit hook que recuerde regenerar la solución cuando se toquen archivos en `solution/scripts/` o tablas Dataverse.
- [ ] Validación automática de que `solution/package/` y `code-app/power.config.json` están sincronizados (no se han quedado desfasados).
