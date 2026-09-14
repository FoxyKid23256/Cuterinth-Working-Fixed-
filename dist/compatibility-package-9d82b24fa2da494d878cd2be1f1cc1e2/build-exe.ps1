[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$outputDirectory = Join-Path $projectDirectory 'dist'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

if (-not (Test-Path -LiteralPath $compiler)) {
    throw '.NET Framework C# compiler was not found on this Windows installation.'
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$compilerArguments = @(
    '/nologo'
    '/target:winexe'
    '/optimize+'
    "/out:$outputDirectory\Cuterinth.exe"
    "/resource:$projectDirectory\default.js,Cuterinth.default.js"
    '/reference:System.dll'
    '/reference:System.Core.dll'
    '/reference:System.Net.Http.dll'
    '/reference:System.Web.Extensions.dll'
    '/reference:System.Windows.Forms.dll'
)

$themeFiles = Get-ChildItem -LiteralPath (Join-Path $projectDirectory 'themes') -Filter '*.json' |
    Sort-Object -Property Name

if ($themeFiles.Count -eq 0) {
    throw 'No bundled theme JSON files were found.'
}

foreach ($themeFile in $themeFiles) {
    $resourceName = "Cuterinth.themes.$($themeFile.Name)"
    $compilerArguments += "/resource:$($themeFile.FullName),$resourceName"
}

$compilerArguments += "$projectDirectory\Cuterinth.cs"
$compilerArguments += "$projectDirectory\ThemeCatalog.cs"

& $compiler $compilerArguments

if ($LASTEXITCODE -ne 0) {
    throw "Cuterinth build failed with exit code $LASTEXITCODE."
}

Write-Host "Built $outputDirectory\Cuterinth.exe"
