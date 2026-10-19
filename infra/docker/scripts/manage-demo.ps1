# Windows PowerShell entry point of the local team demo (B5a). It only finds Git Bash and runs
# manage-demo.sh (same folder) with the same arguments; every check and action lives there.
# Guide (Indonesian): docs/development/cloudflare-demo.md
#
#   .\infra\docker\scripts\manage-demo.ps1 prepare
#   .\infra\docker\scripts\manage-demo.ps1 tunnel https://<kata-acak>.trycloudflare.com
#   .\infra\docker\scripts\manage-demo.ps1 check
#
# If Windows refuses to run scripts, allow them for this window only:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
param(
    [Parameter(Position = 0)][string]$Command = "help",
    [Parameter(Position = 1, ValueFromRemainingArguments = $true)][string[]]$Arguments
)

$ErrorActionPreference = "Stop"

# Git for Windows ships bash.exe in <Git>\bin. Never C:\Windows\System32\bash.exe: that is WSL,
# a different Linux with its own Docker setup and file paths.
$candidates = @()
$git = Get-Command git.exe -ErrorAction SilentlyContinue
if ($git) {
    $candidates += Join-Path (Split-Path (Split-Path $git.Source -Parent) -Parent) "bin\bash.exe"
}
$candidates += @(
    (Join-Path $env:ProgramFiles "Git\bin\bash.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Git\bin\bash.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\Git\bin\bash.exe")
)
$bash = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $bash) {
    Write-Host "GAGAL  Git Bash tidak ditemukan. Pasang Git for Windows (https://git-scm.com/download/win), lalu buka PowerShell baru." -ForegroundColor Red
    exit 1
}

$script = (Join-Path $PSScriptRoot "manage-demo.sh") -replace '\\', '/'
# The hints manage-demo.sh prints then show this PowerShell form of the command.
$env:SOLVEIT_DEMO_ENTRY = ".\infra\docker\scripts\manage-demo.ps1"
$forward = @($Command)
if ($Arguments) { $forward += $Arguments }

& $bash $script @forward
exit $LASTEXITCODE
