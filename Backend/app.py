from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import io
from extractor import get_url_features

app = Flask(__name__)
# CRITICAL: This allows your React app (port 3000) to talk to this API (port 5000)
CORS(app, resources={r"/api/*": {"origins": "*"}}) 

# 1. LOAD MODEL
try:
    model = joblib.load("phishing_model_v2.pkl")
    feature_names = joblib.load("feature_names_v2.pkl")
    print("✅ Model loaded successfully!")
except Exception as e:
    print(f"❌ MODEL ERROR: {e}")

@app.route('/')
def home():
    return "AI Backend is LIVE on Port 5000"

# --- SINGLE URL ROUTE ---
@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.get_json()
    url = data.get('url')
    print(f"🔍 Single Scan: {url}")
    # ... (your existing logic)
    return jsonify({"status": "success", "url": url, "is_phishing": False}) # placeholder

# --- DATASET UPLOAD ROUTE ---
@app.route('/api/upload', methods=['POST'])
def upload_file():
    print("📂 Upload request received!") # If you don't see this, the problem is Frontend
    
    if 'file' not in request.files:
        print("❌ No file in request")
        return jsonify({"error": "No file"}), 400
    
    file = request.files['file']
    
    try:
        # Read CSV
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        df = pd.read_csv(stream)
        print(f"📊 CSV Loaded. Rows: {len(df)}")

        # Find URL column
        url_col = next((c for c in df.columns if 'url' in c.lower()), None)
        if not url_col:
            return jsonify({"error": "No 'url' column found in CSV"}), 400

        # Process first 5 rows for the demo
        results = []
        for url in df[url_col].head(5):
            features = get_url_features(url)
            # Alignment logic...
            results.append({"url": url, "is_phishing": True}) # Example

        return jsonify({"total": len(df), "results": results})

    except Exception as e:
        print(f"❌ PROCESS ERROR: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)