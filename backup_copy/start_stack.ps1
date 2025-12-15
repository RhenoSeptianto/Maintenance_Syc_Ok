# Start Docker Desktop (if installed) minimized
$dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if (Test-Path $dockerDesktop) {
  try { Start-Process -FilePath $dockerDesktop -ArgumentList '--open-minimized' -ErrorAction SilentlyContinue } catch {}
}

# Wait until Docker engine is ready (max 5 minutes)
$deadline = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $deadline) {
  try {
    & docker version *>$null
    if ($LASTEXITCODE -eq 0) { break }
  } catch {}
  Start-Sleep -Seconds 5
}

# Bring up the stack
Set-Location 'D:\maintenance_prodution'
& docker compose up -d
