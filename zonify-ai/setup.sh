#!/bin/bash

# Zonify API Setup Script
echo "Starting Zonify API setup..."

# 1. Create Virtual Environment
echo "Creating virtual environment..."
python -m venv venv

# 2. Activate Virtual Environment
source venv/Scripts/activate || source venv/bin/activate

# 3. Install Dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# 4. Check for Model Files
if [ ! -f "models/zonify_model.keras" ]; then
    echo "⚠️ Warning: models/zonify_model.keras not found. Please ensure model file is placed in Api/models/ before running the app."
fi

if [ ! -f "models/scaler.pkl" ]; then
    echo "⚠️ Warning: models/scaler.pkl not found. Please ensure scaler file is placed in Api/models/ before running the app."
fi

# 5. Check for .env file
if [ ! -f ".env" ]; then
    echo "Creating .env template..."
    echo "PORT=5000" > .env
    echo "GEMINI_API_KEY=YOUR_API_KEY_HERE" >> .env
    echo "Please update .env with your actual GEMINI_API_KEY."
fi

echo "Setup complete. To run the app: 'python app.py'"
