# Ejecutar con pwsh -NoProfile -File solution/scripts/tests/regenerate-solution.Tests.ps1
$ErrorActionPreference = 'Stop'
$SourceScript = Join-Path (Split-Path -Parent $PSScriptRoot) 'regenerate-solution.ps1'
$TestRoot = Join-Path ([System.IO.Path]::GetTempPath()) "GoOfi-regenerate-tests-$([guid]::NewGuid())"
$FixtureScripts = Join-Path $TestRoot 'solution/scripts'
$EnvPath = Join-Path $TestRoot '.env'
$PacCalls = [System.Collections.Generic.List[object]]::new()

function pac {
    $PacCalls.Add(@($args))
    $global:LASTEXITCODE = 0
    if ($args[0] -eq 'solution' -and $args[1] -eq 'export') {
        Set-Content -LiteralPath $args[5] -Value 'test zip'
    }
    if ($args[0] -eq 'solution' -and $args[1] -eq 'unpack') {
        New-Item -ItemType Directory -Path (Join-Path $args[5] 'Workflows') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $args[5] 'Workflows/flujo.json') -Value @(
            '"defaultValue": "https://apps.powerapps.com/play/e/11111111-1111-1111-1111-111111111111/app/22222222-2222-2222-2222-222222222222?tenantId=33333333-3333-3333-3333-333333333333",'
            '"defaultValue": "persona@ejemplo.onmicrosoft.com;otra@ejemplo.com",'
            '"defaultValue": "sin datos"'
        )
    }
}

function Assert-Profile {
    param([string]$Expected)
    if ($PacCalls.Count -ne 3 -or ($PacCalls[0] -join '|') -ne "auth|select|--name|$Expected") {
        throw "Perfil seleccionado inesperado: $($PacCalls | ConvertTo-Json -Compress)"
    }
    $PacCalls.Clear()
}

function Assert-ConfigurationError {
    param([string]$MessagePattern)
    $Caught = $false
    try {
        & $FixtureScript
    }
    catch {
        if ($_.Exception.Message -notlike $MessagePattern) { throw }
        $Caught = $true
    }
    if (-not $Caught -or $PacCalls.Count -ne 0) {
        throw 'Una configuración inválida debe fallar antes de invocar PAC.'
    }
}

try {
    New-Item -ItemType Directory -Path $FixtureScripts -Force | Out-Null
    $FixtureScript = Join-Path $FixtureScripts 'regenerate-solution.ps1'
    Copy-Item -LiteralPath $SourceScript -Destination $FixtureScript

    Assert-ConfigurationError '*Falta*.env*'
    Set-Content -LiteralPath $EnvPath -Value '# Sin perfil'
    Assert-ConfigurationError '*única entrada*'
    Set-Content -LiteralPath $EnvPath -Value 'GOOFI_PAC_PROFILE=""'
    Assert-ConfigurationError '*vacío*'
    Set-Content -LiteralPath $EnvPath -Value 'GOOFI_PAC_PROFILE="sin-cerrar'
    Assert-ConfigurationError '*comillas sin cerrar*'
    Set-Content -LiteralPath $EnvPath -Value @('GOOFI_PAC_PROFILE=uno', 'GOOFI_PAC_PROFILE=dos')
    Assert-ConfigurationError '*única entrada*'

    foreach ($Value in @('perfil-local', '"perfil local"', "'perfil local'")) {
        Set-Content -LiteralPath $EnvPath -Value @('# Comentario', '', "  GOOFI_PAC_PROFILE = $Value  ")
        & $FixtureScript
        Assert-Profile $Value.Trim('"', "'")
    }

    Set-Content -LiteralPath $EnvPath -Value 'GOOFI_PAC_PROFILE=$(comando-no-ejecutable)'
    & $FixtureScript
    Assert-Profile '$(comando-no-ejecutable)'

    $Flow = Get-Content -LiteralPath (Join-Path $TestRoot 'solution/package/Workflows/flujo.json') -Raw
    if ($Flow -match '1111|2222|3333|@ejemplo' -or $Flow -notmatch '{GUID DE TU ENTORNO}' -or
        $Flow -notmatch '{CORREOS SEPARADOS POR ;}' -or $Flow -notmatch 'sin datos') {
        throw "Los flujos conservan IDs o correos del entorno: $Flow"
    }

    Remove-Item -LiteralPath $EnvPath -Force
    & $FixtureScript -PacProfileName 'perfil-explicito'
    Assert-Profile 'perfil-explicito'

    & $FixtureScript -PacProfileName ''
    if ($PacCalls.Count -ne 2 -or $PacCalls[0][0] -ne 'solution') {
        throw 'El perfil activo solo se usa con un parámetro vacío explícito.'
    }

    Write-Host 'OK: lectura de .env, comillas, errores, contenido literal, sobrescrituras y limpieza de IDs y correos en flujos; PAC simulado.'
}
finally {
    Remove-Item -LiteralPath $TestRoot -Recurse -Force
}
