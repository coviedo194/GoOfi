# Regenera la carpeta solution/package/ exportando desde Dataverse.
# Uso: pwsh solution/scripts/regenerate-solution.ps1
# Lee GOOFI_PAC_PROFILE del .env de la raíz del repo.

param(
    [string]$PacProfileName,
    [string]$SolutionName = "OVIGIGOF"
)

$ErrorActionPreference = "Stop"

# Estructura esperada:
#   solution/
#   ├── package/                   ← aquí se desempaqueta la solución
#   ├── scripts/
#   │   └── regenerate-solution.ps1
#   ├── solution.zip               ← zip temporal (se borra al final)
#   └── README.md
$ScriptDir   = $PSScriptRoot
$SolutionDir = Split-Path -Parent $ScriptDir
$PackageDir  = Join-Path $SolutionDir "package"
$ZipPath     = Join-Path $SolutionDir "solution.zip"

if (-not $PSBoundParameters.ContainsKey('PacProfileName')) {
    $EnvPath = Join-Path (Split-Path -Parent $SolutionDir) ".env"
    if (-not (Test-Path -LiteralPath $EnvPath -PathType Leaf)) {
        throw "Falta $EnvPath. Copia .env.example como .env en la raíz del repo y configura GOOFI_PAC_PROFILE con el nombre de perfil de 'pac auth list', o indica -PacProfileName."
    }

    $ProfileEntries = @(Get-Content -LiteralPath $EnvPath | Where-Object { $_ -match '^\s*GOOFI_PAC_PROFILE\s*=' })
    if ($ProfileEntries.Count -ne 1) {
        throw "Configura una única entrada GOOFI_PAC_PROFILE en $EnvPath con el nombre de perfil de 'pac auth list'."
    }

    $PacProfileName = ($ProfileEntries[0] -split '=', 2)[1].Trim()
    if ($PacProfileName.StartsWith('"') -or $PacProfileName.StartsWith("'")) {
        $Quote = $PacProfileName.Substring(0, 1)
        if ($PacProfileName.Length -lt 2 -or -not $PacProfileName.EndsWith($Quote)) {
            throw "GOOFI_PAC_PROFILE tiene comillas sin cerrar en $EnvPath."
        }
        $PacProfileName = $PacProfileName.Substring(1, $PacProfileName.Length - 2).Trim()
    }
    if ([string]::IsNullOrWhiteSpace($PacProfileName)) {
        throw "GOOFI_PAC_PROFILE está vacío en $EnvPath. Indica el nombre del perfil del entorno fuente no administrado; consulta 'pac auth list'."
    }
}

if ([string]::IsNullOrWhiteSpace($PacProfileName)) {
    Write-Host "Usando el perfil PAC activo..." -ForegroundColor Cyan
}
else {
    Write-Host "Seleccionando perfil PAC '$PacProfileName'..." -ForegroundColor Cyan
    pac auth select --name $PacProfileName
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Exportando solución '$SolutionName' como no administrada..." -ForegroundColor Cyan
if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

pac solution export --name $SolutionName --path $ZipPath --managed false
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Limpiando carpeta de destino '$PackageDir'..." -ForegroundColor Cyan
if (Test-Path $PackageDir) {
    Remove-Item $PackageDir -Recurse -Force
}

Write-Host "Desempaquetando en '$PackageDir'..." -ForegroundColor Cyan
pac solution unpack --zipfile $ZipPath --folder $PackageDir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Los flujos exportados guardan como defaultValue el valor actual de algunas
# variables de entorno (URL de la app con IDs de entorno, app y tenant; correos
# de notificación). Se sustituyen por plantillas para no publicar datos del
# entorno de desarrollo; cada entorno configura su valor actual.
Write-Host "Ocultando IDs y correos del entorno en los flujos..." -ForegroundColor Cyan
$Guid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
$AppUrlPattern = "https://apps\.powerapps\.com/play/e/$Guid/(a|app)/$Guid\?tenantId=$Guid"
$AppUrlPlaceholder = 'https://apps.powerapps.com/play/e/{GUID DE TU ENTORNO}/app/{GUID DE LA APP}?tenantId={TU TENANT ID}'
$EmailDefaultPattern = '("defaultValue":\s*")[^"]*@[^"]*(")'
Get-ChildItem -LiteralPath (Join-Path $PackageDir "Workflows") -Filter *.json -ErrorAction SilentlyContinue | ForEach-Object {
    $Text = [System.IO.File]::ReadAllText($_.FullName)
    $Clean = [regex]::Replace($Text, $AppUrlPattern, $AppUrlPlaceholder)
    $Clean = [regex]::Replace($Clean, $EmailDefaultPattern, '${1}{CORREOS SEPARADOS POR ;}${2}')
    if ($Clean -ne $Text) { [System.IO.File]::WriteAllText($_.FullName, $Clean) }
}

Write-Host "Eliminando ZIP temporal '$ZipPath'..." -ForegroundColor Cyan
if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

Write-Host ""
Write-Host "Proceso completado. La solución está en: $PackageDir" -ForegroundColor Green
Write-Host "Recuerda commitear los cambios en solution/package/." -ForegroundColor Yellow
