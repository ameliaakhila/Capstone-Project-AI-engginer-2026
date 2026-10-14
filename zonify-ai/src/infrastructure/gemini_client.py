import os
from google import genai
from typing import Optional

class GeminiClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = None
        
        if not self.api_key or self.api_key == "YOUR_API_KEY_HERE":
            print("⚠️ WARNING: GEMINI_API_KEY belum dikonfigurasi di .env")
            return
            
        try:
            # The ONLY initialization you need in the new SDK
            self.client = genai.Client(api_key=self.api_key)
        except Exception as e:
            print(f"⚠️ WARNING: Gagal inisialisasi awal: {str(e)}")

    def generate_recommendation(
        self,
        verdict: str,
        competitor_density: float,
        jarak_kompetitor: float,
    ) -> str:
        # Check if client was successfully initialized
        if not self.client:
            return "Rekomendasi AI tidak tersedia (API Key belum dikonfigurasi)."

        prompt = (
            f"Analisis singkat (2 kalimat) dari sisi tata kota: Lokasi toko berstatus {verdict}. "
            f"Data: Jarak ke kompetitor terdekat {jarak_kompetitor}m dan kepadatan kompetitor {competitor_density}. "
            f"Berikan saran kepatuhan regulasi."
        )

        models_to_try = [
            'gemini-2.5-flash-preview-05-20',  
            'gemini-2.0-flash',
            'gemini-1.5-flash',
        ]
        last_error = "Tidak ada model yang merespon"

        for model_name in models_to_try:
            try:
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                last_error = str(e)
                print(f"⚠️ Model {model_name} gagal: {last_error}")
                continue

        return f"Gagal mendapatkan rekomendasi AI: {last_error}. Pastikan API KEY valid."