---
title: Zonify Api
emoji: 🏪
colorFrom: green
colorTo: red
sdk: docker
pinned: false
app_port: 7860
---

# Zonify AI API 🏪

REST API untuk deteksi pelanggaran zonasi minimarket berdasarkan **Perpres 112/2007**, dibangun dengan Flask + TensorFlow.

---

## 🛠️ Setup & Installation

Lihat [QUICK_START.md](./QUICK_START.md) untuk instruksi setup lengkap.

---

## 🚀 Base URL

```
https://melissalau-zonify-api.hf.space
```

---

## 🔗 Endpoints

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/` | Status server |
| POST | `/api/v1/ai/predict` | Prediksi pelanggaran zonasi |
| GET | `/api/v1/ai/analytics` | Data statistik dashboard |
| GET | `/api/v1/ai/model-metadata` | Info & metrik model |

---

## POST `/api/zonasi/predict`

### Request Body

```json
{
  "latitude": -6.2363,
  "longitude": 106.8568,
  "competitor_density": 5,
  "jarak_kompetitor": 162.63,
  "head_to_head": 0,
  "cluster_macro": 4,
  "cluster_hotspot": -1,
  "is_hotspot": 1
}
```

### Field Description

| Field | Tipe | Keterangan |
|---|---|---|
| `latitude` | float | Koordinat lintang lokasi |
| `longitude` | float | Koordinat bujur lokasi |
| `competitor_density` | float | Jumlah kompetitor radius 500m |
| `jarak_kompetitor` | float | Jarak ke kompetitor terdekat (meter) |
| `head_to_head` | float | Flag kompetitor brand sama (0/1) |
| `cluster_macro` | float | ID cluster makro HDBSCAN |
| `cluster_hotspot` | float | Probabilitas cluster HDBSCAN |
| `is_hotspot` | int | Flag area hotspot (0/1) |

### Response

```json
{
  "status": "success",
  "data": {
    "input_received": { "..." },
    "prediction": {
      "probability": 0.7231,
      "confidence_percentage": 72.31,
      "is_violation": true,
      "verdict": "⚠️ PELANGGARAN"
    },
    "indicator_breakdown": {
      "kepadatan_kompetitor_500m": {
        "nilai": 5,
        "status": "Tinggi",
        "is_safe": false
      },
      "jarak_kompetitor_terdekat": {
        "nilai": 162.63,
        "status": "Terlalu Dekat (< 500m)",
        "is_safe": false
      },
      "hotspot_persaingan": {
        "nilai": 1,
        "status": "Ya",
        "is_safe": false
      }
    },
    "ai_recommendation": "Lokasi ini berisiko tinggi..."
  }
}
```

---

## GET `/api/zonasi/analytics`

### Response

```json
{
  "status": "success",
  "data": {
    "summary_cards": {
      "total_checks": 510,
      "total_violations": 146,
      "total_compliant": 364,
      "accuracy_rate_current": "78.2%"
    },
    "charts": {
      "compliance_distribution": ["..."],
      "cluster_analysis": ["..."]
    }
  }
}
```

---

## GET `/api/zonasi/model-metadata`

### Response

```json
{
  "status": "success",
  "data": {
    "model_name": "Zonify Attention-Based Classifier",
    "version": "3.0.0",
    "framework": "TensorFlow 2.x (Keras)",
    "training_metrics": {
      "metrics_evaluated": [
        { "metric": "Accuracy", "value": 0.7744 },
        { "metric": "ROC-AUC Score", "value": 0.8655 },
        { "metric": "F1-Score (Violation)", "value": 0.5455 },
        { "metric": "Recall (Violation)", "value": 0.90 }
      ]
    }
  }
}
```

---

## 🤖 AI Advisor

API ini menggunakan **Google Gemini 2.5 Flash** untuk rekomendasi kebijakan otomatis. Fitur ini opsional — prediksi ML tetap jalan tanpa API Key.

---

## 📊 Model Info

| | Value |
|---|---|
| Arsitektur | TensorFlow Functional API + Custom Layer |
| Custom Layer | `SpatialDensityEmbedding` |
| Custom Loss | `zonasi_custom_loss` (VIOLATION_WEIGHT=6.0) |
| Accuracy | 77.44% |
| AUC-ROC | 0.8655 |
| F1 Score | 0.5455 |
| Recall (Violation) | 0.90 |
| Threshold | 0.41 |
| Dataset | Jakarta Selatan (662 data points) |

---

## 📝 Catatan Model

Fitur `jarak_pasar_meter` dihapus dari versi final karena teridentifikasi sebagai **target leakage** (korelasi 0.57). Model final mengandalkan purely spatial features sehingga dapat menggeneralisasi ke kondisi yang lebih kompleks.