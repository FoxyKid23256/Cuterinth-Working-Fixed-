$ErrorActionPreference = 'Stop'
foreach ($name in @('injector.js','build.js')) {
    $source = [IO.File]::ReadAllText((Join-Path (Get-Location) $name))
    $result = & './tests/Invoke-Cdp.ps1' -Expression "(function(require, __dirname, process) { $source })" | ConvertFrom-Json
    if ($result.result.type -ne 'function') { throw "$name did not parse" }
    Write-Output "$name syntax passed"
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($name in @('Cuterinth-Windows','Cuterinth-GitHub')) {
    $zip = [IO.Compression.ZipFile]::OpenRead((Join-Path (Get-Location) "artifacts\$name.zip"))
    try { Write-Output "$name.zip contains $($zip.Entries.Count) entries" } finally { $zip.Dispose() }
}
