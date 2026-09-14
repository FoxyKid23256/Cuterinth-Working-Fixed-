$ErrorActionPreference = 'Stop'
$source = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'default.js'))
$suite = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'tests\browser-tests.js'))
$expression = $suite.Replace('/* CUTERINTH_SOURCE */', $source)
& (Join-Path $PSScriptRoot 'tests\Invoke-Cdp.ps1') -Expression $expression
