# Zonify - Smart Retail Zoning Intelligence System 🏢

Zonify adalah sebuah platform cerdas berbasis web yang dirancang untuk mendeteksi, menganalisis, dan memantau zonasi ritel guna mencegah dan mengidentifikasi pelanggaran jarak antar minimarket/ritel modern sesuai dengan regulasi yang berlaku.
## 1. Cara Instalasi dan Penyiapan Proyek

Proyek ini menggunakan arsitektur *monorepo* yang memisahkan aplikasi *backend* (`apps/api`) dan *frontend* (`apps/web`). Berikut adalah langkah-langkah untuk menjalankan proyek ini di lingkungan lokal.
### Prasyarat Sistem
Pastikan perangkat kamu sudah terinstal:
* [Node.js](https://nodejs.org/) (Versi 18 atau terbaru disarankan)
* [Docker Desktop](https://www.docker.com/products/docker-desktop) (Untuk menjalankan *database* dan layanan lainnya)
* Git

### Langkah Instalasi Lengkap
**1. Clone Repository**
Unduh kode sumber ke komputer lokal dengan menjalankan perintah berikut di terminal:
git clone [https://github.com/sintalestari416-a11y/project-capstone.git](https://github.com/sintalestari416-a11y/project-capstone.git)
cd project-capstone

**2. Instalasi Dependensi**
Jalankan perintah berikut pada *root directory* untuk menginstal seluruh dependensi sistem:
npm install

**3. Konfigurasi Environment Variables (.env)**
Siapkan file .env pada dua direktori berikut berdasarkan template yang tersedia:
* Backend (apps/api/.env): Konfigurasi URI koneksi database (PostgreSQL) dan kredensial sistem terkait.
* Frontend (apps/web/.env): Konfigurasi URL API : VITE_API_URL=http://localhost:3000.

**4. Inisialisasi Layanan Docker**
Proyek ini menggunakan Docker untuk memfasilitasi penyediaan database dan environment yang terisolasi. Jalankan perintah berikut:
docker-compose up -d
(Catatan: Panduan inisialisasi dan seeding data via Docker tersedia pada docker/DOCKER-SEED-GUIDE.md)

**5. Migrasi dan Seeding Database (Prisma)**
cd apps/api
npx prisma migrate dev
npm run seed  # Eksekusi jika skrip seed tersedia
cd ../..
6. Menjalankan Aplikasi (Mode Development)**
Dari root directory, jalankan perintah berikut untuk mengaktifkan API dan Web secara bersamaan:
npm run dev
Frontend (React/Vite): http://localhost:5173
Backend API (Node.js): http://localhost:3000

**Petunjuk Penggunaan Fitur**
Setelah sistem beroperasi, fitur utama Zonify dapat diakses melalui alur berikut:
Akses Dashboard: Navigasikan browser ke URL frontend dan lakukan otentikasi menggunakan kredensial hasil seeding database.
Pemetaan Zonasi (Map View): Akses menu Map/Peta untuk visualisasi koordinat ritel. Sistem secara otomatis menandai area klaster (flagged clusters) yang terindikasi melanggar batas regulasi zonasi.
Manajemen Pelanggaran: Akses halaman Violations untuk meninjau data ritel yang melanggar ketentuan jarak minimum. Fitur ini memfasilitasi proses tinjauan (review) administratif.
Analisis dan Prediksi AI: Akses halaman Analytics/Rankings untuk mengevaluasi data analitik, statistik per distrik, serta prediksi tren pertumbuhan ritel yang ditenagai oleh model AI.
Log Audit: Pantau riwayat perubahan status data dan aturan zonasi melalui menu Audit Logs.

**Spesifikasi Teknis Proyek**
* Tumpukan Teknologi (Tech Stack)
* Frontend: React.js, Vite, Tailwind CSS
* Backend: Node.js, Express.js
* Database & ORM: PostgreSQL, Prisma ORM
* Infrastruktur & Deployment: Docker, Rumahweb

**Struktur Direktori Utama**
* apps/api/: Memuat kode sumber backend (Routes, Controllers, Services, Prisma Schema, dan dataset CSV).
* apps/web/: Memuat kode sumber frontend (React Components, Pages, Context, Hooks).
* docker/: Memuat file pendukung dan konfigurasi infrastruktur (Nginx/Docker).

**LINK YPRESENTASI YT**
https://youtu.be/nLEC6gSH-kE?si=YuILFh_2RzTixITv
