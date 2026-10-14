# Zonasi ML API

REST API untuk inferensi model deteksi pelanggaran zonasi minimarket, dibangun dengan FastAPI + TensorFlow.

---

## Requirements

- Python 3.12
- pip

---

## Setup

### 1. Clone repo & masuk ke folder

```bash
cd ml-api
```

### 2. Install dependencies

```bash
python -m pip install -r requirements.txt
```

### 3. Pastikan file model tersedia

Struktur folder harus seperti ini:

```
ml-api/
├── main.py
├── requirements.txt
├── README.md
├── models/
│   ├── zonify_model.keras
│   └── scaler.pkl
```

> `zonify_model.keras` dan `scaler.pkl` bisa didownload dari Google Drive tim atau GitHub repo.

### 4. Jalankan server

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Server berjalan di: `http://localhost:8000`

---

## Endpoints

### `POST /predict`

Memprediksi apakah sebuah lokasi melanggar zonasi minimarket.

**Request Body:**

```json
{
  "latitude": -6.2363,
  "longitude": 106.8568,
  "competitor_density_500m": 5.0,
  "jarak_kompetitor_meter": 162.63,
  "kompetitor_head_to_head": 0.0,
  "cluster_hdbscan_makro": 2.0,
  "cluster_hdbscan_prob": 0.85,
  "is_hotspot": 1
}
```

**Field Validation:**

| Field | Tipe | Validasi |
|---|---|---|
| `latitude` | float | -6.4 sampai -6.1 (Jakarta Selatan) |
| `longitude` | float | 106.7 sampai 107.0 (Jakarta Selatan) |
| `competitor_density_500m` | float | >= 0 |
| `jarak_kompetitor_meter` | float | >= 0 |
| `cluster_hdbscan_prob` | float | 0.0 sampai 1.0 |
| `is_hotspot` | int | 0 atau 1 |

**Response:**

```json
{
  "violation_probability": 0.7231,
  "verdict": "PELANGGARAN",
  "threshold_used": 0.41
}
```

| Field | Keterangan |
|---|---|
| `violation_probability` | Probabilitas pelanggaran (0.0 – 1.0) |
| `verdict` | `"PELANGGARAN"` atau `"PATUH"` |
| `threshold_used` | Threshold yang digunakan (0.41) |

---

### `GET /health`

Cek status server.

**Response:**

```json
{ "status": "ok" }
```

---

## Swagger UI

Buka browser dan akses:

```
http://localhost:8000/docs
```

---

## Model Info

| | Value |
|---|---|
| Arsitektur | TensorFlow Functional API + Custom Layer |
| Custom Layer | `SpatialDensityEmbedding` |
| Custom Loss | `zonasi_custom_loss` (weighted, VIOLATION_WEIGHT=6.0) |
| Accuracy | 77.44% |
| AUC-ROC | 0.8655 |
| F1 Score | 0.5455 |
| Recall (Violation) | 0.90 |
| MAE | 0.2256 |
| Threshold | 0.41 |
| Dataset | Jakarta Selatan (662 data points) |

## Catatan Model

Model final ini merupakan versi yang telah diperbaiki dari versi awal. Pada versi awal, ditemukan **target leakage** pada fitur `jarak_pasar_meter` (korelasi 0.57 dengan label) yang menyebabkan akurasi 100% secara artifisial. Fitur tersebut dihapus karena pada dasarnya mereplikasi business rule IF sederhana tanpa nilai tambah ML.

Model final mengandalkan purely spatial features (density, clustering, koordinat) sehingga dapat menggeneralisasi ke kondisi yang lebih kompleks. Threshold dipilih 0.41 berdasarkan threshold tuning untuk memaksimalkan F1 Score dan Recall pelanggaran (0.90).
