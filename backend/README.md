# Backend (fase berikutnya)

Folder ini dicadangkan untuk Laravel REST API Solveit Indonesia. Belum ada kode atau endpoint: pengembangan dimulai di branch `backend`.

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

Kontrak API awal (inquiry, proyek, layanan) dan peta jalan Solveit OpsHub ada di [`docs/integration-plan.md`](../docs/integration-plan.md). Simpan rahasia di `backend/.env` (diabaikan Git) dan dokumentasikan variabel di `.env.example`.
