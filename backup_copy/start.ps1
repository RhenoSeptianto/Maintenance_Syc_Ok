param([switch]$Rebuild)
if ($Rebuild) { docker compose up -d --build } else { docker compose up -d }
Write-Host 'Frontend: http://localhost:3012  Backend: http://localhost:4010'
