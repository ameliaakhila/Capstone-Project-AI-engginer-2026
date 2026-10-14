import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from src.adapters.ml_repository import MLRepository
from src.infrastructure.gemini_client import GeminiClient
from src.use_cases.evaluate_zonasi import EvaluateZonasi
from src.adapters.controllers import ZonasiController

load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app)

    ml_repo = MLRepository(
        model_path  = "models/zonify_model.keras",
        scaler_path = "models/scaler.pkl"
    )
    gemini_client     = GeminiClient(api_key=os.getenv("GEMINI_API_KEY"))
    evaluate_use_case = EvaluateZonasi(ml_repo, gemini_client)
    zonasi_controller = ZonasiController(evaluate_use_case)

    @app.route('/', methods=['GET'])
    def index():
        return {"status": "online", "message": "Zonify AI API is running successfully", "version": "3.0.0"}

    @app.route('/api/v1/ai/predict', methods=['POST'])
    def predict():
        return zonasi_controller.predict()

    @app.route('/api/v1/ai/analytics', methods=['GET'])
    def analytics():
        return zonasi_controller.get_analytics()

    @app.route('/api/v1/ai/model-metadata', methods=['GET'])
    def metadata():
        return zonasi_controller.get_model_metadata()

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv("PORT", 7860))
    app.run(debug=False, use_reloader=False, host='0.0.0.0', port=port)