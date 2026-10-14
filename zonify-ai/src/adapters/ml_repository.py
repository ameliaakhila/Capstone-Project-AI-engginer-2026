import pickle
import numpy as np
import tensorflow as tf
import keras
from src.infrastructure.custom_layers import SpatialDensityEmbedding, zonasi_custom_loss, RoundedMAE

# ──────────────────────────────────────────────
# Keras Dense patch — drop quantization_config on load
# Pick ONE based on your TF version:
#
#   TF >= 2.20  →  keep Patch 1, comment out Patch 2
#   TF <= 2.19  →  keep Patch 2, comment out Patch 1
# ──────────────────────────────────────────────

# Patch 1 — TF 2.20+
# original_dense_init = tf.keras.layers.Dense.__init__
# def patched_dense_init(self, *args, **kwargs):
#     kwargs.pop('quantization_config', None)
#     original_dense_init(self, *args, **kwargs)
# tf.keras.layers.Dense.__init__ = patched_dense_init

# Patch 2 — TF 2.19 and below
_orig_dense_from_config = keras.layers.Dense.from_config.__func__
@classmethod
def _patched_dense_from_config(cls, config):
    config.pop("quantization_config", None)
    return _orig_dense_from_config(cls, config)
keras.layers.Dense.from_config = _patched_dense_from_config

class MLRepository:
    def __init__(self, model_path: str, scaler_path: str):
        self.model_path  = model_path
        self.scaler_path = scaler_path
        self.model  = None
        self.scaler = None

    def _load_resources(self):
        if self.model is not None:
            return
        try:
            self.model = tf.keras.models.load_model(
                self.model_path,
                custom_objects={
                    "SpatialDensityEmbedding": SpatialDensityEmbedding,
                    "zonasi_custom_loss"     : zonasi_custom_loss,
                    "RoundedMAE"             : RoundedMAE,
                }
            )
            with open(self.scaler_path, "rb") as f:
                self.scaler = pickle.load(f)
            print(f"✅ Model & Scaler loaded from {self.model_path}")
        except Exception as e:
            print(f"❌ Failed to load model/scaler: {e}")

    def predict(self, input_data: list) -> float:
        self._load_resources()
        if self.model is None or self.scaler is None:
            raise RuntimeError("Model or Scaler not loaded")
        input_array  = np.array([input_data], dtype=np.float32)
        scaled_array = self.scaler.transform(input_array)
        prediction   = self.model.predict(scaled_array, verbose=0)
        return float(prediction[0][0])