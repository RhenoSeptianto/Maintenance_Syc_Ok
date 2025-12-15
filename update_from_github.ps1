# Update script untuk PC kantor (tanpa Git)
# Download update dari GitHub dan apply ke folder ini

Write-Host "=== Maintenance System - GitHub Update ===" -ForegroundColor Cyan
Write-Host ""

# 1. Backup .env (jangan sampai hilang!)
if (Test-Path .env) {
    Write-Host "[1/6] Backup .env..." -ForegroundColor Yellow
    Copy-Item .env .env.backup -Force
    Write-Host "  ✓ .env backed up to .env.backup" -ForegroundColor Green
} else {
    Write-Host "  ⚠ .env not found!" -ForegroundColor Red
    exit 1
}

# 2. Stop containers
Write-Host "[2/6] Stopping containers..." -ForegroundColor Yellow
docker compose down
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to stop containers" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Containers stopped" -ForegroundColor Green

# 3. Download update dari GitHub
Write-Host "[3/6] Downloading from GitHub..." -ForegroundColor Yellow
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$zipUrl = "https://codeload.github.com/RhenoSeptianto/Maintenance_Sys/zip/refs/heads/main"
$zipFile = "update.zip"

try {
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile -UseBasicParsing
    Write-Host "  ✓ Downloaded update.zip" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Download failed: $_" -ForegroundColor Red
    Write-Host "  Restoring .env and exiting..." -ForegroundColor Yellow
    Copy-Item .env.backup .env -Force
    exit 1
}

# 4. Extract update
Write-Host "[4/6] Extracting update..." -ForegroundColor Yellow
if (Test-Path temp) { Remove-Item temp -Recurse -Force }
Expand-Archive -Path $zipFile -DestinationPath temp -Force
Write-Host "  ✓ Extracted" -ForegroundColor Green

# 5. Apply update (backend, frontend, docker-compose.yml, scripts)
Write-Host "[5/6] Applying update..." -ForegroundColor Yellow

# Backup old backend/frontend
if (Test-Path backend) { Remove-Item backend.old -Recurse -Force -ErrorAction SilentlyContinue; Rename-Item backend backend.old }
if (Test-Path frontend) { Remove-Item frontend.old -Recurse -Force -ErrorAction SilentlyContinue; Rename-Item frontend frontend.old }

# Copy new files
Copy-Item -Path "temp\Maintenance_Sys-main\backend" -Destination . -Recurse -Force
Copy-Item -Path "temp\Maintenance_Sys-main\frontend" -Destination . -Recurse -Force
Copy-Item -Path "temp\Maintenance_Sys-main\docker-compose.yml" -Destination . -Force
Copy-Item -Path "temp\Maintenance_Sys-main\start.ps1" -Destination . -Force -ErrorAction SilentlyContinue
Copy-Item -Path "temp\Maintenance_Sys-main\stop.ps1" -Destination . -Force -ErrorAction SilentlyContinue
Copy-Item -Path "temp\Maintenance_Sys-main\logs.ps1" -Destination . -Force -ErrorAction SilentlyContinue

Write-Host "  ✓ Files updated" -ForegroundColor Green

# Restore .env
Copy-Item .env.backup .env -Force
Write-Host "  ✓ .env restored" -ForegroundColor Green

# Cleanup
Remove-Item temp -Recurse -Force
Remove-Item $zipFile -Force

# 6. Start containers
Write-Host "[6/6] Starting containers with rebuild..." -ForegroundColor Yellow
docker compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓✓✓ UPDATE COMPLETED! ✓✓✓" -ForegroundColor Green
    Write-Host ""
    Write-Host "Check status: docker compose ps" -ForegroundColor Cyan
    Write-Host "View logs: docker compose logs -f backend" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "✗ Update completed but containers failed to start" -ForegroundColor Red
    Write-Host "Check logs: docker compose logs" -ForegroundColor Yellow
}
