import os
import numpy as np
import tensorflow as tf
from dotenv import load_dotenv
from src.infrastructure.custom_layers import SpatialDensityEmbedding, zonasi_custom_loss, RoundedMAE
from src.adapters.ml_repository import MLRepository

load_dotenv()

def run_inference():
    repo = MLRepository(
        model_path  = "models/zonify_model.keras",
        scaler_path = "models/scaler.pkl",
    )

    # 10 features (tanpa jarak_pasar_meter):
    # lat, lng, density, jarak_komp, h2h, cluster_macro, cluster_prob,
    # is_hotspot, density*h2h, density/(jarak+1)
    density   = 5.0
    jarak     = 162.63
    head2head = 0.0
    sample_input = np.array([[
        -6.2363, 106.8568,
        density, jarak, head2head,
        4.0, 0.85,
        1,
        density * head2head,
        density / (jarak + 1),
    ]], dtype=np.float32)

    try:
        scaled      = repo.scaler.transform(sample_input)
        probability = float(repo.model.predict(scaled, verbose=0)[0][0])
        print("-" * 30)
        print(f"Probabilitas Pelanggaran : {probability:.4f}")
        print(f"Status: {'⚠️ PELANGGARAN' if probability >= 0.5 else '✅ PATUH'}")
        print("-" * 30)
    except Exception as e:
        print(f"❌ Inference error: {e}")

if __name__ == "__main__":
    run_inference()
