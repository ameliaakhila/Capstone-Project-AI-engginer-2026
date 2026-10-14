from src.domain.entities import LocationInput, PredictionResult
from src.adapters.ml_repository import MLRepository
from src.infrastructure.gemini_client import GeminiClient

THRESHOLD = 0.41

class EvaluateZonasi:
    def __init__(self, ml_repo: MLRepository, gemini_client: GeminiClient):
        self.ml_repo       = ml_repo
        self.gemini_client = gemini_client

    def execute(self, location: LocationInput) -> PredictionResult:
        # 1. ML Prediction
        prob         = self.ml_repo.predict(location.to_array())
        is_violation = prob >= THRESHOLD
        verdict      = "⚠️ PELANGGARAN" if is_violation else "✅ PATUH"

        # 2. Indicators (FR-02) — tanpa jarak_pasar, fokus spatial features
        indicators = {
            "kepadatan_kompetitor_500m": {
                "nilai"   : location.competitor_density,
                "status"  : "Tinggi" if location.competitor_density > 4 else "Normal",
                "is_safe" : location.competitor_density <= 4,
            },
            "jarak_kompetitor_terdekat": {
                "nilai"   : location.jarak_kompetitor,
                "status"  : "Terlalu Dekat (< 500m)" if location.jarak_kompetitor < 500 else "Aman",
                "is_safe" : location.jarak_kompetitor >= 500,
            },
            "hotspot_persaingan": {
                "nilai"   : location.is_hotspot,
                "status"  : "Ya" if location.is_hotspot == 1 else "Tidak",
                "is_safe" : location.is_hotspot == 0,
            },
        }

        # 3. AI Advisor (FR-03)
        ai_advice = self.gemini_client.generate_recommendation(
            verdict            = verdict,
            competitor_density = location.competitor_density,
            jarak_kompetitor   = location.jarak_kompetitor,
        )

        confidence = prob * 100 if is_violation else (1 - prob) * 100
        return PredictionResult(
            probability            = round(prob, 4),
            is_violation           = is_violation,
            verdict                = verdict,
            confidence_percentage  = round(confidence, 2),
            indicators             = indicators,
            ai_recommendation      = ai_advice,
        )
