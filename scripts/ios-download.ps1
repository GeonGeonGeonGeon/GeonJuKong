param([string]$RunId)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$project = (Get-Location).Path
$repository = 'GeonGeonGeonGeon/GeonJuKong'

try {
    if ($RunId -and $RunId -notmatch '^\d+$') { throw 'Run ID must be a number.' }
    $ghCommand = Get-Command gh -ErrorAction SilentlyContinue
    $gh = if ($ghCommand) { $ghCommand.Source } else { Join-Path $project '.tools/gh/bin/gh.exe' }
    if (-not (Test-Path -LiteralPath $gh -PathType Leaf)) { throw 'GitHub CLI is missing. Run iosBuild.bat once to install it.' }
    $ErrorActionPreference = 'Continue'
    & $gh auth status 2>$null
    $authExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($authExit -ne 0) {
        & $gh auth login --hostname github.com --web
        if ($LASTEXITCODE -ne 0) { throw 'GitHub sign-in failed.' }
    }
    if (-not $RunId) {
        $json = & $gh run list --repo $repository --workflow ios-build.yml --limit 30 --json databaseId,conclusion,createdAt
        if ($LASTEXITCODE -ne 0) { throw 'Could not list iOS builds.' }
        $run = @($json | ConvertFrom-Json) | Where-Object { $_.conclusion -eq 'success' } | Sort-Object createdAt -Descending | Select-Object -First 1
        if (-not $run) { throw 'No successful iOS build was found. Check the Actions page.' }
        $RunId = [string]$run.databaseId
    }
    $destination = Join-Path $project "artifacts/ios-build-$RunId"
    & $gh run download $RunId --repo $repository --name GeonJuKong-ios-unsigned --dir $destination
    if ($LASTEXITCODE -ne 0) { throw 'Could not download the iOS build artifact.' }
    $ipa = Join-Path $destination 'GeonJuKong-unsigned.ipa'
    if (-not (Test-Path -LiteralPath $ipa -PathType Leaf)) { throw 'The artifact has no IPA file.' }
    $contents = & tar -tf $ipa
    if ($LASTEXITCODE -ne 0) { throw 'The IPA is not a readable ZIP archive.' }
    foreach ($item in @('Payload/App.app/App', 'Payload/App.app/Assets.car', 'Payload/App.app/public/src/native-entry.js')) {
        if ($contents -notcontains $item) { throw "The IPA is missing $item." }
    }
    $latest = Join-Path $project 'artifacts/GeonJuKong-latest.ipa'
    Copy-Item -LiteralPath $ipa -Destination $latest -Force
    Write-Host "Sideloadly IPA: $latest"
    Write-Host 'Open Sideloadly, select this IPA, choose your iPhone, and sign/install with your Apple account.'
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
exit 0
