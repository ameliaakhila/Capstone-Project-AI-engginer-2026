import os
import google.generativeai as genai
from typing import Optional


class GeminiClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model   = None

        if not self.api_key or self.api_key == "YOUR_API_KEY_HERE":
            print("⚠️ WARNING: GEMINI_API_KEY belum dikonfigurasi di .env")
            return
        try:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        except Exception as e:
            print(f"⚠️ WARNING: Gagal inisialisasi awal: {str(e)}")

    def generate_recommendation(
        self,
        verdict: str,
        competitor_density: float,
        jarak_kompetitor: float,
    ) -> str:
        if not self.api_key or self.api_key == "YOUR_API_KEY_HERE":
            return "Rekomendasi AI tidak tersedia (API Key belum dikonfigurasi)."

        prompt = (
            f"Analisis singkat (2 kalimat) dari sisi tata kota: Lokasi toko berstatus {verdict}. "
            f"Data: Jarak ke kompetitor terdekat {jarak_kompetitor}m dan kepadatan kompetitor {competitor_density}. "
            f"Berikan saran kepatuhan regulasi."
        )

        models_to_try = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-flash-latest',
            'gemini-pro-latest',
        ]
        last_error = "Tidak ada model yang merespon"

        for model_name in models_to_try:
            try:
                temp_model = genai.GenerativeModel(model_name)
                response   = temp_model.generate_content(prompt)
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                last_error = str(e)
                if "404" in last_error or "not found" in last_error.lower():
                    continue
                return f"Gagal AI ({model_name}): {last_error}"

        return f"Gagal mendapatkan rekomendasi AI: {last_error}. Pastikan API KEY valid dan library sudah di-upgrade."
