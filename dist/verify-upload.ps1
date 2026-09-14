$source = [IO.File]::ReadAllText((Join-Path (Get-Location) 'injector.build.js'))
$result = & './tests/Invoke-Cdp.ps1' -Expression "(function(require, __dirname, process) { $source })" | ConvertFrom-Json
if ($result.result.type -ne 'function') { throw 'Generated injector did not parse.' }
Write-Output 'Generated injector syntax passed.'
