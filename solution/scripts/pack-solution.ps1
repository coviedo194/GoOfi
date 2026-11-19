# Empaqueta solution/package/ en un .zip listo para subir como Release de GitHub.
# Uso: pwsh solution/scripts/pack-solution.ps1
# (ejecutar desde la raíz del repo)
#
# Qué hace:
#   1. Lee la versión actual de solution/package/Other/Solution.xml.
#   2. Incrementa el último segmento (revision build) en +0.1.
#      Ejemplo: 1.0.0.0 → 1.0.0.1
#   3. Actualiza el XML con la nueva versión.
#   4. Empaqueta solution/package/ → solution/solution.zip (ignorado por git).
#   5. Imprime los comandos sugeridos para subir a release / importar a Dataverse.

param(
    # Incremento opcional del último segmento. Por defecto +0.1 (revision build).
    [double]$BumpRevision = 0.1
)

$ErrorActionPreference = "Stop"

$ScriptDir   = $PSScriptRoot
$SolutionDir = Split-Path -Parent $ScriptDir
$PackageDir  = Join-Path $SolutionDir "package"
$OtherDir    = Join-Path $PackageDir "Other"
$SolutionXml = Join-Path $OtherDir "Solution.xml"
$ZipPath     = Join-Path $SolutionDir "solution.zip"

# 1. Comprobaciones previas
if (-not (Test-Path $SolutionXml)) {
    throw "No se encuentra $SolutionXml. ¿Has ejecutado regenerate-solution.ps1 primero?"
}

Write-Host "Leyendo versión actual de la solución..." -ForegroundColor Cyan
[xml]$xmlDoc = Get-Content $SolutionXml -Raw
$currentVersion = $xmlDoc.ImportExportXml.SolutionManifest.Version
Write-Host "  Versión actual: $currentVersion" -ForegroundColor Gray

# 2. Calcular y aplicar nueva versión
$parts = $currentVersion.Split('.')
if ($parts.Count -ne 4) {
    throw "La versión '$currentVersion' no tiene el formato X.X.X.X esperado por Power Platform."
}
$lastSegment = [int]$parts[3]
$bumpInt     = [int][math]::Round($BumpRevision, 0)
$newLast     = $lastSegment + $bumpInt
$parts[3]    = "$newLast"
$newVersion  = ($parts -join '.')

Write-Host "  Nueva versión:  $newVersion" -ForegroundColor Green

$xmlDoc.ImportExportXml.SolutionManifest.Version = $newVersion
$xmlDoc.Save($SolutionXml)
Write-Host "  Solution.xml actualizado." -ForegroundColor Gray

# 3. Empaquetar
if (Test-Path $ZipPath) {
    Write-Host "Eliminando zip anterior '$ZipPath'..." -ForegroundColor Gray
    Remove-Item $ZipPath -Force
}

Write-Host ""
Write-Host "Empaquetando solution/package/ → $ZipPath ..." -ForegroundColor Cyan
pac solution pack --zipfile $ZipPath --folder $PackageDir --packagetype Unmanaged
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 4. Resumen y siguientes pasos
$zipSize = (Get-Item $ZipPath).Length
Write-Host ""
Write-Host "✓ Zip creado: $ZipPath ($([math]::Round($zipSize/1KB, 1)) KB)" -ForegroundColor Green
Write-Host ""
Write-Host "Versión: $currentVersion → $newVersion" -ForegroundColor Green
Write-Host ""
Write-Host "Siguientes pasos:" -ForegroundColor Cyan
Write-Host "  1. Crea un tag en GitHub:    git tag v$newVersion" -ForegroundColor Gray
Write-Host "  2. Empuja el tag:            git push --tags" -ForegroundColor Gray
Write-Host "  3. Sube el zip como asset del Release desde la web de GitHub," -ForegroundColor Gray
Write-Host "     o usa la GitHub Action definida en docs/FUTURE_AUTOMATIONS.md." -ForegroundColor Gray
Write-Host ""
Write-Host "Para importar la solución en otro entorno de Dataverse:" -ForegroundColor Cyan
Write-Host "  pac solution import --path $ZipPath" -ForegroundColor Gray
