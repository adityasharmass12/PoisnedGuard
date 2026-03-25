from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import io
import os
from extractor import get_url_features

app = Flask(__name__)
# CRITICAL: This allows your React app (port 3000) to talk to this API (port 5000)
CORS(app, resources={r"/api/*": {"origins": "*"}}) 

print("✅ PoisonGuard AI Backend Ready!")
print("📍 Using Heuristic Phishing Detection (Accurate & Fast)")
print("🔒 Features: URL analysis, safe domain whitelist, red flag detection")

@app.route('/')
def home():
    return "AI Backend is LIVE on Port 5000"

# --- SINGLE URL ROUTE ---
@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.get_json()
    url = data.get('url')
    print(f"🔍 Single Scan: {url}")
    
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    
    try:
        # Use heuristic detector
        result = get_url_features(url)
        
        if "error" in result:
            return jsonify({"error": "Invalid URL"}), 400
        
        return jsonify({
            "url": url,
            "is_phishing": result["is_phishing"],
            "confidence": round(result["confidence"] * 100, 2),
            "reasons": result.get("reasons", [])
        })
    
    except Exception as e:
        print(f"❌ PREDICTION ERROR: {e}")
        return jsonify({"error": str(e)}), 500

# --- DATASET UPLOAD ROUTE ---
@app.route('/api/upload', methods=['POST'])
def upload_file():
    print("📂 Upload request received!")
    
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

        # Process URLs and get predictions
        total_rows = len(df)
        results = []
        phishing_count = 0
        safe_count = 0
        
        # Process all URLs with heuristic detector
        for idx, url in enumerate(df[url_col]):
            try:
                # Use heuristic detector
                result = get_url_features(str(url))
                
                if "error" in result:
                    results.append({
                        "url": str(url),
                        "is_phishing": False,
                        "confidence": 0,
                        "error": "Invalid URL"
                    })
                    continue
                
                is_phishing = result["is_phishing"]
                confidence = result["confidence"] * 100
                
                if is_phishing:
                    phishing_count += 1
                else:
                    safe_count += 1
                
                results.append({
                    "url": str(url),
                    "is_phishing": bool(is_phishing),
                    "confidence": round(confidence, 2),
                    "reasons": result.get("reasons", [])
                })
                
                # Print progress every 50 rows
                if (idx + 1) % 50 == 0:
                    print(f"✅ Processed {idx + 1}/{total_rows} URLs")
                    
            except Exception as url_err:
                print(f"⚠️  Error processing URL at row {idx}: {url_err}")
                results.append({
                    "url": str(url),
                    "is_phishing": False,
                    "confidence": 0,
                    "error": str(url_err)
                })
        
        print(f"✅ Analysis Complete: {phishing_count} phishing, {safe_count} safe out of {total_rows}")
        
        return jsonify({
            "total": total_rows,
            "phishing_count": phishing_count,
            "safe_count": safe_count,
            "results": results
        })

    except Exception as e:
        print(f"❌ PROCESS ERROR: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)