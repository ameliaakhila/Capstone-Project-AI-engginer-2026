import pickle
import numpy as np
import tensorflow as tf
from src.infrastructure.custom_layers import SpatialDensityEmbedding, zonasi_custom_loss, RoundedMAE


class MLRepository:
    def __init__(self, model_path: str, scaler_path: str):
        self.model_path  = model_path
        self.scaler_path = scaler_path
        self.model  = None
        self.scaler = None
        self._load_resources()

    def _load_resources(self):
        try:
            self.model = tf.keras.models.load_model(
                self.model_path,
                custom_objects={
                    "SpatialDensityEmbedding": SpatialDensityEmbedding,
                    "zonasi_custom_loss"      : zonasi_custom_loss,
                    "RoundedMAE"              : RoundedMAE,
                }
            )
            with open(self.scaler_path, "rb") as f:
                self.scaler = pickle.load(f)
            print(f"✅ Model & Scaler loaded from {self.model_path}")
        except Exception as e:
            print(f"❌ Failed to load model/scaler: {e}")

    def predict(self, input_data: list) -> float:
        if self.model is None or self.scaler is None:
            raise RuntimeError("Model or Scaler not loaded")
        input_array  = np.array([input_data], dtype=np.float32)
        scaled_array = self.scaler.transform(input_array)
        prediction   = self.model.predict(scaled_array, verbose=0)
        return float(prediction[0][0])
