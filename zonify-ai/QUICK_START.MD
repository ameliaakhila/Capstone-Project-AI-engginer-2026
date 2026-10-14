# Panduan Cepat Zonify AI API 🚀
Direktori ini berisi model AI dan API Flask untuk proyek Zonify, yang berfungsi mengevaluasi kepatuhan lokasi ritel berdasarkan **Perpres 112/2007**.

---

## 🖥️ Environment

Pilih sesuai setup kamu:

| | Case A | Case B |
|---|---|---|
| **Python** | 3.12 | 3.10 |
| **TensorFlow** | 2.21.0 | 2.19.0 |
| **Cocok untuk** | Python 3.12 (local / HuggingFace) | Python 3.10 |

> Lihat `requirements.txt` untuk detail versi semua library.

---

## 🛠️ Persiapan Lingkungan

Pastikan Anda telah menginstal **Python 3.10+**. Disarankan untuk menggunakan virtual environment.

```bash
# 1. Masuk ke direktori api
cd api

# 2. Buat virtual environment
python -m venv venv

# 3. Aktifkan virtual environment
# Di Windows:
.\venv\Scripts\activate
# Di Linux/macOS:
source venv/bin/activate

# 4. Upgrade pip
python -m pip install --upgrade pip setuptools wheel

# 5. Install numpy dulu (dependency order)
pip install numpy==1.26.4

# 6. Install semua dependencies
pip install -r requirements.txt
```

---

## ⚙️ Konfigurasi Environment

```bash
# Copy file contoh
cp .env.example .env

# Edit .env dan isi API key
# GEMINI_API_KEY=isi_kunci_anda_disini
```

---

## 🧠 Pelatihan Model AI

Buka `AI_ModelTraining.ipynb` di Google Colab dan jalankan semua sel.

Proses ini akan menghasilkan dua file di folder `models/`:
- `zonify_model.keras` — model TensorFlow
- `scaler.pkl` — StandardScaler untuk normalisasi data

---

## 🚀 Menjalankan API

```bash
python app.py
```

Setelah server berjalan, verifikasi di browser:
👉 **http://127.0.0.1:5000**

---

## 🔗 Daftar Endpoint API

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| **GET** | `/` | Mengecek status server (Online/Offline). |
| **GET** | `/api/v1/ai/model-metadata` | Melihat metrik performa model (Akurasi, AUC-ROC). |
| **GET** | `/api/v1/ai/analytics` | Mendapatkan data statistik zonasi untuk dashboard. |
| **POST** | `/api/v1/ai/predict` | Mengirim data lokasi untuk mendapatkan hasil analisis kepatuhan. |

### Cara Tes Prediksi (PowerShell):

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/v1/ai/predict" -Method Post -ContentType "application/json" -Body '{
    "latitude": -6.2363,
    "longitude": 106.8568,
    "competitor_density": 5,
    "jarak_kompetitor": 162.63,
    "head_to_head": 0,
    "cluster_macro": 4,
    "cluster_hotspot": -1,
    "is_hotspot": 1
   }'
```

---

## 🤖 Konfigurasi AI Advisor (Google Gemini)

Proyek ini menggunakan **Google Gemini 2.5 Flash** untuk memberikan nasihat kebijakan secara otomatis.

1. Fitur ini bersifat **opsional**. Jika API Key tidak diatur, prediksi Machine Learning tetap berjalan normal.
2. Dapatkan API Key gratis di [Google AI Studio](https://aistudio.google.com/).
3. Masukkan kunci tersebut ke dalam file `.env`:
   ```env
   GEMINI_API_KEY=isi_kunci_anda_disini
   ```

---

## 📂 Struktur Folder API (Clean Architecture)

```
api/
├── app.py                  # Entry point Flask
├── inference.py            # Script inference standalone
├── requirements.txt
├── .env.example
├── .gitignore
├── Dockerfile
├── AI_ModelTraining.ipynb
├── models/
│   ├── zonify_model.keras  # Model TensorFlow
│   └── scaler.pkl          # StandardScaler
└── src/
    ├── domain/             # Entities (LocationInput, PredictionResult)
    ├── use_cases/          # Business logic (EvaluateZonasi)
    ├── adapters/           # Controllers & MLRepository
    └── infrastructure/     # CustomLayers & GeminiClient
```

---

## 📊 Model Info

| | Value |
|---|---|
| Accuracy | 77.44% |
| AUC-ROC | 0.8655 |
| F1 Score | 0.5455 |
| Recall (Violation) | 0.90 |
| Threshold | 0.41 |