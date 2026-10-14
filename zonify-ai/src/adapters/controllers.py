from flask import request, jsonify
from src.domain.entities import LocationInput
from src.use_cases.evaluate_zonasi import EvaluateZonasi


class ZonasiController:
    def __init__(self, evaluate_use_case: EvaluateZonasi):
        self.evaluate_use_case = evaluate_use_case

    def predict(self):
        try:
            data = request.get_json()

            required_fields = [
                "latitude", "longitude", "competitor_density",
                "jarak_kompetitor", "head_to_head",
                "cluster_macro", "cluster_hotspot", "is_hotspot"
            ]
            for field in required_fields:
                if field not in data:
                    return jsonify({"status": "fail", "message": f"Fitur '{field}' wajib diisi."}), 400

            location = LocationInput(
                latitude           = float(data["latitude"]),
                longitude          = float(data["longitude"]),
                competitor_density = float(data["competitor_density"]),
                jarak_kompetitor   = float(data["jarak_kompetitor"]),
                head_to_head       = float(data["head_to_head"]),
                cluster_macro      = float(data["cluster_macro"]),
                cluster_hotspot    = float(data["cluster_hotspot"]),
                is_hotspot         = int(data["is_hotspot"]),
            )

            result = self.evaluate_use_case.execute(location)

            return jsonify({
                "status": "success",
                "data": {
                    "input_received": data,
                    "prediction": {
                        "probability"           : result.probability,
                        "confidence_percentage" : result.confidence_percentage,
                        "is_violation"          : result.is_violation,
                        "verdict"               : result.verdict,
                    },
                    "indicator_breakdown" : result.indicators,
                    "ai_recommendation"   : result.ai_recommendation,
                }
            }), 200

        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    def get_analytics(self):
        chart_pie_compliance = [
            {"name": "Patuh Zonasi (Compliance)", "value": 64, "color": "#4ade80"},
            {"name": "Pelanggaran (Violation)",   "value": 36, "color": "#f87171"},
        ]
        chart_bar_cluster_violations = [
            {"cluster": "Cluster 0 (Suburban)",           "total_pengajuan": 120, "pelanggaran": 15},
            {"cluster": "Cluster 1 (Komersial Padat)",    "total_pengajuan": 85,  "pelanggaran": 42},
            {"cluster": "Cluster 2 (Residensial)",        "total_pengajuan": 210, "pelanggaran": 28},
            {"cluster": "Cluster 3 (Pusat Kota/Macro 4)", "total_pengajuan": 95,  "pelanggaran": 61},
        ]
        return jsonify({
            "status": "success",
            "data": {
                "summary_cards": {
                    "total_checks"           : 510,
                    "total_violations"       : 146,
                    "total_compliant"        : 364,
                    "accuracy_rate_current"  : "78.2%",
                },
                "charts": {
                    "compliance_distribution": chart_pie_compliance,
                    "cluster_analysis"       : chart_bar_cluster_violations,
                }
            }
        }), 200

    def get_model_metadata(self):
        return jsonify({
            "status": "success",
            "data": {
                "model_name"  : "Zonify Attention-Based Classifier",
                "version"     : "3.0.0",
                "framework"   : "TensorFlow 2.x (Keras)",
                "architecture": "Functional API with Custom SpatialDensityEmbedding Layer",
                "training_metrics": {
                    "loss_function"     : "Weighted Custom Binary Cross-Entropy (VIOLATION_WEIGHT=2.0)",
                    "final_val_loss"    : 1.0434,
                    "threshold"         : 0.5,
                    "leakage_removed"   : "jarak_pasar_meter dihapus (korelasi 0.57, target leakage)",
                    "metrics_evaluated" : [
                        {"metric": "Accuracy",                "value": 0.7820},
                        {"metric": "ROC-AUC Score",           "value": 0.7801},
                        {"metric": "Rounded MAE",             "value": 0.2180},
                        {"metric": "F1-Score (Violation)",    "value": 0.5085},
                    ]
                },
                "input_features_schema": [
                    {"name": "latitude",           "type": "float", "description": "Koordinat lintang lokasi"},
                    {"name": "longitude",          "type": "float", "description": "Koordinat bujur lokasi"},
                    {"name": "competitor_density", "type": "float", "description": "Jumlah kompetitor radius 500m"},
                    {"name": "jarak_kompetitor",   "type": "float", "description": "Jarak ke kompetitor terdekat (meter)"},
                    {"name": "head_to_head",       "type": "float", "description": "Flag kompetitor langsung brand sama (0/1)"},
                    {"name": "cluster_macro",      "type": "float", "description": "ID Cluster Makro HDBSCAN"},
                    {"name": "cluster_hotspot",    "type": "float", "description": "Probabilitas cluster HDBSCAN"},
                    {"name": "is_hotspot",         "type": "int",   "description": "Flag area hotspot (0/1)"},
                ]
            }
        }), 200
