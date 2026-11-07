$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$project = (Get-Location).Path

function Get-BuildTool($command, $repository, $assetPattern, $relativePath) {
    $installed = Get-Command $command -ErrorAction SilentlyContinue
    if ($installed) { return $installed.Source }
    $folder = Join-Path $project ".tools/$command"
    $executable = Join-Path $folder $relativePath
    if (Test-Path -LiteralPath $executable -PathType Leaf) { return $executable }
    Write-Host "Downloading $command..."
    $headers = @{ 'User-Agent' = 'GeonJuKong-iOS-build'; 'Accept' = 'application/vnd.github+json' }
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repository/releases/latest" -Headers $headers
        $asset = $release.assets | Where-Object { $_.name -match $assetPattern } | Select-Object -First 1
        if (-not $asset) { throw 'Windows ZIP asset not found.' }
        $archive = Join-Path $project ".tools/$command.zip"
        New-Item -ItemType Directory -Path (Split-Path $folder) -Force | Out-Null
        try {
            Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archive -Headers $headers
            Expand-Archive -LiteralPath $archive -DestinationPath $folder -Force
        } finally {
            Remove-Item -LiteralPath $archive -ErrorAction SilentlyContinue
        }
    } catch {
        throw "Could not download $command from GitHub. Check the internet connection. $_"
    }
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw "Downloaded $command, but the executable was not found." }
    return $executable
}

try {
    $git = Get-BuildTool 'git' 'git-for-windows/git' '^MinGit-.*-64-bit\.zip$' 'cmd/git.exe'
    $gh = Get-BuildTool 'gh' 'cli/cli' '^gh_.*_windows_amd64\.zip$' 'bin/gh.exe'
    $env:PATH = "$(Split-Path $git -Parent);$(Split-Path $gh -Parent);$env:PATH"
    $ErrorActionPreference = 'Continue'
    & $gh auth status 2>$null
    $authExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($authExit -ne 0) {
        Write-Host 'Sign in to GitHub to start the iOS build.'
        & $gh auth login --hostname github.com --web
        if ($LASTEXITCODE -ne 0) { throw 'GitHub sign-in failed.' }
    }
    $branch = & $git symbolic-ref --quiet --short HEAD
    if ($LASTEXITCODE -ne 0 -or -not $branch) { throw 'Check out a Git branch before building.' }
    $changes = & $git status --porcelain --untracked-files=normal -- . ':(exclude)artifacts'
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the project changes.' }
    if ($changes) { throw 'Commit and push the project changes before building.' }
    $head = & $git rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the current commit.' }
    $remote = & $git ls-remote --heads origin "refs/heads/$branch"
    if ($LASTEXITCODE -ne 0 -or -not $remote) { throw 'The current branch was not found on origin.' }
    if (($remote -split '\s+')[0] -ne $head) { throw 'Push the current commit to origin before building.' }
    $buildId = "$(Get-Date -Format 'yyyyMMddHHmmss')-$(Get-Random -Maximum 1000000000)"
    $ErrorActionPreference = 'Continue'
    $workflowOutput = & $gh workflow run ios-build.yml --ref $branch -f "build_id=$buildId" 2>&1
    $workflowExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($workflowExit -ne 0) { throw "Could not start the GitHub Actions iOS build: $($workflowOutput -join ' ')" }
    Write-Host 'Building a fresh iOS app on macOS...'
    $run = $null
    for ($attempt = 0; $attempt -lt 30 -and -not $run; $attempt++) {
        Start-Sleep -Seconds 2
        $json = & $gh run list --workflow ios-build.yml --branch $branch --limit 30 --json databaseId,displayTitle,headSha
        if ($LASTEXITCODE -ne 0) { throw 'Could not locate the iOS build run.' }
        $runs = ConvertFrom-Json -InputObject ($json -join "`n")
        foreach ($candidate in $runs) {
            if ($candidate.displayTitle -eq "iOS unsigned build $buildId" -and $candidate.headSha -eq $head) {
                $run = $candidate
                break
            }
        }
    }
    if (-not $run) { throw 'The new build did not appear in GitHub Actions.' }
    $runId = [string]$run.databaseId
    if ($runId -notmatch '^\d+$') { throw 'The build returned an invalid run ID.' }
    & $gh run watch $runId --exit-status
    if ($LASTEXITCODE -ne 0) { throw 'The iOS build failed. Check its GitHub Actions log.' }

    $destination = Join-Path $project "artifacts/ios-build-$runId"
    $ErrorActionPreference = 'Continue'
    $downloadOutput = & $gh run download $runId --name GeonJuKong-ios-unsigned --dir $destination 2>&1
    $downloadExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($downloadExit -ne 0) { throw "Could not download the new IPA from run ${runId}: $($downloadOutput -join ' ')" }
    $ipa = Join-Path $destination 'GeonJuKong-unsigned.ipa'
    if (-not (Test-Path -LiteralPath $ipa -PathType Leaf)) { throw 'The build artifact has no IPA.' }
    $contents = & tar -tf $ipa
    if ($LASTEXITCODE -ne 0) { throw 'The IPA is not a readable ZIP archive.' }
    foreach ($item in @('Payload/App.app/App', 'Payload/App.app/Assets.car', 'Payload/App.app/public/src/native-entry.js')) {
        if ($contents -notcontains $item) { throw "The IPA is missing $item." }
    }
    $latest = Join-Path $project 'artifacts/GeonJuKong-latest.ipa'
    Copy-Item -LiteralPath $ipa -Destination $latest -Force
    $oldTemplate = Join-Path $project 'artifacts/GeonJuKong-20261101'
    $oldIpa = Join-Path $project 'artifacts/GeonJuKong-sideload.ipa'
    $artifactRoot = (Resolve-Path -LiteralPath (Join-Path $project 'artifacts')).Path
    if ((Resolve-Path -LiteralPath $oldTemplate -ErrorAction SilentlyContinue).Path -eq (Join-Path $artifactRoot 'GeonJuKong-20261101')) {
        Remove-Item -LiteralPath $oldTemplate -Recurse -Force
    }
    if (Test-Path -LiteralPath $oldIpa -PathType Leaf) { Remove-Item -LiteralPath $oldIpa -Force }
    Write-Host "Fresh Sideloadly IPA: $latest"
    Write-Host 'Sideloadly will sign the IPA for your iPhone.'
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
exit 0
