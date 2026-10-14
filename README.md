# Zonify - Smart Retail Zoning Intelligence System

Zonify adalah sistem cerdas berbasis WebGIS untuk analisis, pemetaan zonasi ritel modern (minimarket) terhadap pasar tradisional, dan prediksi berbasis Machine Learning / AI untuk mendeteksi pelanggaran jarak minimum, tingkat kejenuhan wilayah (saturation), serta memberikan rekomendasi titik koordinat alternatif.

---

## 📁 Struktur dan Fungsi Direktori Proyek

Proyek ini terorganisasi ke dalam struktur folder berikut beserta penjelasan fungsinya masing-masing:

```text
Capstone-Project-AI-engginer-2026/
 ┣ data/                          # Menyimpan dataset mentah (raw), dataset bersih (cleaned), dan data dictionary pendukung analisis
 ┣ models/                        # Menyimpan artefak file model Machine Learning & Scaler yang telah dilatih (.pkl, .keras, dll)
 ┣ notebooks/                     # Kumpulan Jupyter Notebooks untuk eksperimen, exploratory data analysis (EDA), dan riset ML
 ┣ outputs/                       # Hasil keluaran eksperimen seperti visualisasi grafik (PNG) dan peta spasial (HTML)
 ┣ zonify-be-fe/                  # Monorepo Utama (Backend & Frontend)
 ┃  ┣ apps/
 ┃  ┃  ┣ api/                     # Backend Express.js API & Prisma ORM
 ┃  ┃  │  ┣ prisma/               # Skema database (schema.prisma), migrasi, dan seeders
 ┃  ┃  │  ┗ src/                  # Logika server: controllers, middlewares, routes, services
 ┃  ┃  ┗ web/                     # Frontend React + Vite + Leaflet WebGIS
 ┃  ┃     ┗ src/                  # Kode antarmuka: components, context, hooks, pages, & utils
 ┃  ┗ packages/                   # Shared workspace packages
 ┗ zonify-ai/                     # Layanan Machine Learning / AI Service (Python / FastAPI / TensorFlow)
    ┣ models/                     # Artefak khusus model AI yang digunakan oleh layanan inferensi
    ┣ src/                        # Modul pendukung AI: adapters, domain entities, use_cases, infrastructure
    ┗ app.py / inference.py       # File utama / entry point untuk menjalankan layanan inferensi AI
```

---

## 🚀 Quick Start (Panduan Menjalankan Proyek)

### 1. Menjalankan Backend (`zonify-be-fe/apps/api`)
1. Masuk ke direktori API:
   ```bash
   cd zonify-be-fe/apps/api
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Buat file `.env` di dalam folder `apps/api/` dan isi dengan konfigurasi database (`DATABASE_URL`, `DIRECT_URL`, dll).
4. Generate Prisma & jalankan migrasi/seed database:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```
5. Jalankan server development backend:
   ```bash
   npm run dev
   ```
   *(Backend akan aktif di `http://localhost:3001`)*

---

### 2. Menjalankan Frontend (`zonify-be-fe/apps/web`)
1. Buka terminal baru, masuk ke direktori web:
   ```bash
   cd zonify-be-fe/apps/web
   ```
2. Instal dependensi (gunakan `--legacy-peer-deps` jika terjadi konflik versi React):
   ```bash
   npm install --legacy-peer-deps
   ```
3. Jalankan server development frontend:
   ```bash
   npm run dev
   ```
   *(Frontend akan aktif di `http://localhost:5173`)*

---

### 3. Menjalankan AI Service (`zonify-ai`)
1. Buka terminal baru, masuk ke direktori AI:
   ```bash
   cd zonify-ai
   ```
2. Instal dependensi Python:
   ```bash
   pip install -r requirements.txt
   ```
3. Pastikan file model dan scaler sudah tersedia di dalam folder `models/`.
4. Jalankan server AI:
   ```bash
   python app.py
   ```
   *(Atau menggunakan uvicorn jika menggunakan FastAPI):*
   ```bash
   python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   *(AI Service akan aktif di `http://localhost:8000`)*

   ## *SELAMAT MENCOBA : )*



