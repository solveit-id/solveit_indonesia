# Backend (fase berikutnya)

Folder ini dicadangkan untuk Laravel REST API milik website Solveit Indonesia (inquiry, konten, admin website). Solveit OpsHub tidak dibangun di sini; ia punya repository sendiri. Belum ada kode atau endpoint: pengembangan dimulai di branch `backend`.

## Target platform

- Laravel 13
- PHP 8.5: minimum 8.5.7, target 8.5.11 atau patch stabil terbaru seri 8.5
- Composer 2

## Memulai

```bash
git checkout backend
composer create-project laravel/laravel backend   # di root repo, folder ini masih kosong
cd backend && php artisan install:api
```

Kontrak API awal (inquiry, proyek, layanan), batas sistem, dan peta jalan integrasi dengan Solveit OpsHub ada di [`docs/architecture/integration-plan.md`](../docs/architecture/integration-plan.md). Simpan rahasia di `backend/.env` (diabaikan Git) dan dokumentasikan variabel di `.env.example`.
