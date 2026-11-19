# FUTURE_AUTOMATIONS

Lista viva de automatizaciones pendientes para el repositorio. Cada entrada describe **qué falta**, **por qué importa** y, cuando aplica, **un esbozo de cómo implementarlo**.

---

## 📦 Publicación automática de la solución `.zip` como GitHub Release

**Estado actual:** manual. Tras hacer cambios en la solución, el mantenedor debe:

1. Regenerar la solución descomprimida con `solution/scripts/regenerate-solution.ps1`.
2. Empaquetarla en un `.zip` con `solution/scripts/pack-solution.ps1` (que ya incrementa la versión).
3. Subir el `.zip` a mano a GitHub → Releases, como asset del tag de versión.

**Por qué automatizarlo:** cada release requiere un paso manual propenso a olvidos; queremos que cualquier push a `master` (o un tag) publique la versión descargable sin intervención.

### Approach recomendado (GitHub Actions)

Disparador: al crear un **tag** con prefijo `v*` (p. ej. `v1.2.0`), se ejecuta un workflow que:

1. Hace checkout del repo.
2. Instala PowerShell 7 (`pwsh`) y la CLI de Power Platform (`pac`) en el runner.
3. Se autentica en el entorno de Dataverse con un **service principal** (credenciales en GitHub Secrets: `PP_TENANT_ID`, `PP_CLIENT_ID`, `PP_CLIENT_SECRET`, `PP_ENVIRONMENT_ID`).
4. Ejecuta `pwsh solution/scripts/regenerate-solution.ps1` para regenerar la carpeta `solution/package/` (o usa la ya commiteada si la regeneración es costosa).
5. Ejecuta `pwsh solution/scripts/pack-solution.ps1` para incrementar la versión y empaquetar `solution/package/` en `solution/solution.zip`.
6. Crea la release de GitHub con el `.zip` como asset.

### Esqueleto del workflow

```yaml
# .github/workflows/release-solution.yml
name: Release GoOfi solution

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install PowerShell
        uses: microsoft/action-powershell@v2

      - name: Install Power Platform CLI
        run: |
          pwsh -Command 'Install-Module Microsoft.PowerApps.Administration.PowerShell -Scope CurrentUser -Force'
          # o instalar pac cli nativamente
          dotnet tool install --global Microsoft.PowerApps.CLI.Tool

      - name: Export solution from Dataverse
        env:
          PP_TENANT_ID: ${{ secrets.PP_TENANT_ID }}
          PP_CLIENT_ID: ${{ secrets.PP_CLIENT_ID }}
          PP_CLIENT_SECRET: ${{ secrets.PP_CLIENT_SECRET }}
          PP_ENVIRONMENT_ID: ${{ secrets.PP_ENVIRONMENT_ID }}
        run: pwsh solution/scripts/regenerate-solution.ps1

      - name: Pack solution
        run: pwsh solution/scripts/pack-solution.ps1

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: "GoOfi_${{ github.ref_name }}.zip"
          generate_release_notes: true
```

### Pendientes antes de activar

- [ ] Registrar una **app registration** en Entra ID con permisos de Dataverse en el entorno de exportación.
- [ ] Crear un **service user** en Dataverse vinculado a esa app registration y darle el rol **System Administrator** (o uno equivalente) en el entorno.
- [ ] Configurar los **secrets** `PP_TENANT_ID`, `PP_CLIENT_ID`, `PP_CLIENT_SECRET`, `PP_ENVIRONMENT_ID` en GitHub → Settings → Secrets.
- [ ] Validar que `regenerate-solution.ps1` y `pack-solution.ps1` funcionan en un runner Ubuntu (no solo en macOS).
- [ ] Decidir si la release debe **regenerarse desde Dataverse** o si basta con **reempaquetar la solución ya commiteada** (más rápido, pero puede quedar desfasada).

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
