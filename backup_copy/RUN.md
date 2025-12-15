# Maintenance Production (Windows)

## Prasyarat
- Windows dengan Docker Desktop terpasang.
- Docker Desktop diizinkan start saat login (opsional, skrip ini juga men-starter jika perlu).

## Cara Menjalankan Manual
1. Buka PowerShell sebagai user biasa.
2. Jalankan:
   - Start: `powershell -NoProfile -ExecutionPolicy Bypass -File D:\maintenance_prodution\start_stack.ps1`
   - Stop: `powershell -NoProfile -ExecutionPolicy Bypass -File D:\maintenance_prodution\stop_stack.ps1`

Akses:
- Frontend: http://172.18.121.19:3012
- Backend API: http://172.18.121.19:4010

## Auto Run Saat Login
Sebuah Scheduled Task dibuat untuk mengeksekusi start otomatis saat user login.
Nama task: `MaintenanceStackUp`

Untuk membuat ulang/ubah (opsional):
- Hapus: `schtasks /Delete /TN MaintenanceStackUp /F`
- Buat lagi: `schtasks /Create /TN MaintenanceStackUp /SC ONLOGON /RL HIGHEST /TR "powershell -NoProfile -ExecutionPolicy Bypass -File D:\maintenance_prodution\start_stack.ps1"`

## Catatan
- File compose sudah dikonfigurasi bind ke 0.0.0.0 dan CORS/URL publik ke 172.18.121.19.
- Containers memiliki `restart: unless-stopped`. Jika Docker Desktop aktif saat boot, kontainer akan kembali hidup.
- Volumes Postgres/MinIO menggunakan named external volumes, data tetap aman antar restart.
