# Panduan Cepat Zonify AI API 🚀
Direktori ini berisi model AI dan API Flask untuk proyek Zonify, yang berfungsi mengevaluasi kepatuhan lokasi ritel berdasarkan **Perpres 112/2007**.

## 🛠️ Persiapan Lingkungan
Pastikan Anda telah menginstal **Python 3.10+**. Disarankan untuk menggunakan virtual environment yang tersedia.

```bash
# Masuk ke direktori Api
cd Api

# Buat virtual environment (jika belum ada)
python -m venv venv

# Aktifkan virtual environment
# Di Windows:
.\venv\Scripts\activate
# Di Linux/macOS:
source venv/bin/activate

# Instal dependensi
pip install -r requirements.txt
```

## 🧠 Pelatihan Model AI
Model dapat dilatih ulang menggunakan Notebook.

- **Opsi A (Notebook):** Buka `AI_ModelTraining.ipynb` di Google Colab dan jalankan semua sel.

Proses ini akan menghasilkan dua file utama di folder `models/`:
- `zonify_model.keras`: File biner model TensorFlow yang sudah terlatih.
- `scaler.pkl`: File biner untuk normalisasi data (StandardScaler).

## 🚀 Menjalankan API
Jalankan server Flask dengan perintah:

```bash
python app.py
```

Setelah server berjalan, Anda dapat memverifikasi statusnya melalui browser di:
👉 **http://127.0.0.1:5000** (Akan muncul pesan "Zonify AI API is running successfully")

## 🔗 Daftar Endpoint API
| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| **GET** | `/` | Mengecek status server (Online/Offline). |
| **GET** | `/api/zonasi/model-metadata` | Melihat metrik performa model (Akurasi, AUC-ROC). |
| **GET** | `/api/zonasi/analytics` | Mendapatkan data statistik zonasi untuk dashboard. |
| **POST** | `/api/zonasi/predict` | Mengirim data lokasi untuk mendapatkan hasil analisis kepatuhan. |

### Cara Tes Prediksi (PowerShell):
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/zonasi/predict" -Method Post -ContentType "application/json" -Body '{
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

## 🤖 Konfigurasi AI Advisor (Google Gemini)
Proyek ini menggunakan **Google Gemini 2.5 Flash** untuk memberikan nasihat kebijakan secara otomatis.

1. Fitur ini bersifat **opsional**. Jika API Key tidak diatur, prediksi Machine Learning tetap berjalan normal.
2. Dapatkan API Key gratis di [Google AI Studio](https://aistudio.google.com/).
3. Masukkan kunci tersebut ke dalam file `.env`:
   ```env
   GEMINI_API_KEY=isi_kunci_anda_disini
   ```

## 📂 Struktur Folder API (Clean Architecture)
- **`app.py`**: Titik masuk utama aplikasi Flask.
- **`src/domain/`**: Berisi entitas data bisnis (LocationInput).
- **`src/use_cases/`**: Logika inti yang menggabungkan prediksi ML dan rekomendasi Gemini AI.
- **`src/infrastructure/`**: Implementasi teknis seperti `gemini_client.py` dan `custom_layers.py` (untuk TensorFlow).
- **`models/`**: Tempat penyimpanan file model `.keras` dan scaler `.pkl`.

## 📊 Model Info
| | Value |
|---|---|
| Accuracy | 77.44% |
| AUC-ROC | 0.8655 |
| F1 Score | 0.5455 |
| Recall (Violation) | 0.90 |
| Threshold | 0.41 |
