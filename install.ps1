# devChat installer for Windows (PowerShell 5.1+ or PowerShell 7).
#
#   irm https://raw.githubusercontent.com/jrnoorbaloch/devChat/main/install.ps1 | iex
#
# What it does (and nothing else):
#   1. checks Git, Node.js >= 26 and npm (offers to install missing ones with winget)
#   2. downloads devChat into .\devChat (or updates an existing copy)
#   3. installs dependencies
#   4. runs the setup wizard, which asks: WeChat, WhatsApp or both
#
# Environment overrides: $env:DEVCHAT_DIR, $env:DEVCHAT_REPO_URL,
# $env:DEVCHAT_BRANCH, $env:DEVCHAT_MESSENGERS (e.g. "both", skips the question).
#
# Design notes: everything runs inside Invoke-DevChatInstall so a problem can
# stop the installer with a clear message and no PowerShell stack trace. It
# never calls `exit`, because under `irm | iex` that would close the user's
# PowerShell window.

function Invoke-DevChatInstall {
  $ErrorActionPreference = 'Stop'

  $RepoUrl      = if ($env:DEVCHAT_REPO_URL) { $env:DEVCHAT_REPO_URL } else { 'https://github.com/jrnoorbaloch/devChat.git' }
  $Branch       = if ($env:DEVCHAT_BRANCH)   { $env:DEVCHAT_BRANCH }   else { 'main' }
  $TargetDir    = if ($env:DEVCHAT_DIR)      { $env:DEVCHAT_DIR }      else { 'devChat' }
  $MinNodeMajor = 26

  function Write-Ok   ($m) { Write-Host "[ok] $m" -ForegroundColor Green }
  function Write-Info ($m) { Write-Host "...  $m" -ForegroundColor Yellow }
  function Stop-Install ($m) {
    Write-Host "[x]  $m" -ForegroundColor Red
    throw 'DEVCHAT_INSTALL_STOPPED'
  }

  function Update-SessionPath {
    # winget updates PATH for new terminals only; refresh it for this session.
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
  }

  function Test-Command ($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

  function Get-NodeMajor {
    if (-not (Test-Command 'node')) { return 0 }
    try { return [int](& node -p "process.versions.node.split('.')[0]") } catch { return 0 }
  }

  function Confirm-Yes ($question) {
    $answer = Read-Host "$question [Y/n]"
    return -not ($answer -match '^[nN]')
  }

  function Install-WithWinget ($id, $label) {
    if (-not (Test-Command 'winget')) {
      Stop-Install "$label is missing and winget is not available. Install $label manually, then run this installer again."
    }
    if (-not (Confirm-Yes "Install $label now with winget?")) {
      Stop-Install "Please install $label, then run this installer again."
    }
    winget install --id $id -e --source winget --accept-package-agreements --accept-source-agreements
    Update-SessionPath
  }

  Write-Host ''
  Write-Host 'devChat installer' -ForegroundColor Cyan
  Write-Host ''

  # 1. Git
  if (-not (Test-Command 'git')) { Install-WithWinget 'Git.Git' 'Git' }
  if (-not (Test-Command 'git')) { Stop-Install 'Git was installed but is not on PATH yet. Close this window, open a new PowerShell, and run the installer again.' }
  Write-Ok (git --version)

  # 2. Node.js
  if ((Get-NodeMajor) -lt $MinNodeMajor) {
    $current = if (Test-Command 'node') { node --version } else { 'not installed' }
    Write-Info "devChat needs Node.js $MinNodeMajor+ (you have: $current)."
    Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js LTS'
    if ((Get-NodeMajor) -lt $MinNodeMajor) {
      Stop-Install "Node.js $MinNodeMajor+ is still not active. Close this window, open a new PowerShell, and run the installer again. (Download: https://nodejs.org)"
    }
  }
  Write-Ok "Node.js $(node --version)"
  if (-not (Test-Command 'npm')) { Stop-Install 'npm was not found. Reinstall Node.js from https://nodejs.org (npm comes with it).' }
  Write-Ok "npm $(npm --version)"

  # 3. Download or update devChat
  if (Test-Path (Join-Path $TargetDir '.git')) {
    Write-Info "Updating existing $TargetDir"
    # npm may rewrite the lockfile locally; it is regenerated below anyway.
    git -C $TargetDir checkout --quiet -- package-lock.json 2>$null
    git -C $TargetDir pull --ff-only --quiet
    if ($LASTEXITCODE -ne 0) { Stop-Install "Could not update $TargetDir (local changes?). Run: git -C $TargetDir status" }
  } elseif ((Test-Path $TargetDir) -and (Get-ChildItem $TargetDir -Force | Select-Object -First 1)) {
    Stop-Install "Folder '$TargetDir' already exists and is not a devChat checkout. Remove it or set `$env:DEVCHAT_DIR to another folder."
  } else {
    Write-Info "Downloading devChat into .\$TargetDir"
    git clone --quiet --depth 1 --branch $Branch $RepoUrl $TargetDir
    if ($LASTEXITCODE -ne 0) { Stop-Install 'Download failed. Check your internet connection and try again.' }
  }
  Write-Ok 'devChat source ready'

  Push-Location $TargetDir
  try {
    # 4. Dependencies: `npm ci` installs exactly the tested versions from the
    #    lockfile; fall back to `npm install` once (flaky network, lock mismatch).
    Write-Info 'Installing dependencies (first time takes a minute)'
    npm ci --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) {
      Write-Info 'Retrying with npm install'
      npm install --no-audit --no-fund --loglevel=error
      if ($LASTEXITCODE -ne 0) { Stop-Install "npm install failed. Check your internet connection / proxy, then run: cd $TargetDir; npm install" }
    }
    Write-Ok 'Dependencies installed'

    # 5. Setup wizard: WeChat, WhatsApp or both
    if ($env:DEVCHAT_MESSENGERS) { node bin/init.ts --yes } else { node bin/init.ts }
    if ($LASTEXITCODE -ne 0) { Stop-Install "Setup did not finish. Fix the problem shown above, then run: cd $TargetDir; npm run setup" }
  } finally {
    Pop-Location
  }

  Write-Host ''
  Write-Host "Next:  cd $TargetDir; npm start" -ForegroundColor Cyan
  Write-Host ''
}

try {
  Invoke-DevChatInstall
} catch {
  # Expected stops already printed their message; show anything else plainly.
  if ($_.Exception.Message -ne 'DEVCHAT_INSTALL_STOPPED') {
    Write-Host "[x]  $($_.Exception.Message)" -ForegroundColor Red
  }
}
