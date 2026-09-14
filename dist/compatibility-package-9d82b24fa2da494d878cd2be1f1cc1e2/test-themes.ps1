$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$testDirectory = Join-Path $PSScriptRoot ('dist\theme-tests-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDirectory | Out-Null
$testExe = Join-Path $testDirectory 'ThemeCatalogTests.exe'
& $compiler /nologo /target:exe "/out:$testExe" /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll "$PSScriptRoot\ThemeCatalog.cs" "$PSScriptRoot\tests\ThemeCatalogTests.cs"
if ($LASTEXITCODE -ne 0) { throw 'Theme test compilation failed.' }
& $testExe (Join-Path $testDirectory 'cache')
if ($LASTEXITCODE -ne 0) { throw 'Theme tests failed.' }
