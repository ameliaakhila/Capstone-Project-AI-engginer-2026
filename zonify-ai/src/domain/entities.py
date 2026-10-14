from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class LocationInput:
    latitude: float
    longitude: float
    competitor_density: float
    jarak_kompetitor: float
    head_to_head: float
    cluster_macro: float
    cluster_hotspot: float
    is_hotspot: int

    def to_array(self):
        density = self.competitor_density
        jarak   = self.jarak_kompetitor
        return [
            self.latitude,
            self.longitude,
            density,
            jarak,
            self.head_to_head,
            self.cluster_macro,
            self.cluster_hotspot,
            self.is_hotspot,
            density * self.head_to_head,       
            density / (jarak + 1),             
        ]


@dataclass
class PredictionResult:
    probability: float
    is_violation: bool
    verdict: str
    confidence_percentage: float
    indicators: Dict[str, Any]
    ai_recommendation: str
