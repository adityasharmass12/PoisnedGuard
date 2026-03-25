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

# 1. LOAD MODEL
# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

try:
    model = joblib.load(os.path.join(SCRIPT_DIR, "phishing_model_v2.pkl"))
    feature_names = joblib.load(os.path.join(SCRIPT_DIR, "feature_names_v2.pkl"))
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
    
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    
    try:
        # 1. Extract features from URL
        extracted_data = get_url_features(url)
        
        # 2. Create DataFrame with proper alignment
        input_df = pd.DataFrame([extracted_data])
        
        # Fill missing columns with 0
        for col in feature_names:
            if col not in input_df.columns:
                input_df[col] = 0
        
        # Ensure correct column order
        input_df = input_df[feature_names]
        
        # 3. Get the raw probabilities [Safe_Prob, Phish_Prob]
        probs = model.predict_proba(input_df)[0]
        phish_prob = float(probs[1]) 
        
        # THRESHOLD LOGIC:
        # Only mark as Phishing if the probability is higher than 80%
        # This prevents 'Safe' sites like GitHub from being flagged by accident
        is_phishing = phish_prob > 0.80 
        
        confidence_value = phish_prob if is_phishing else probs[0]
        
        print(f"✅ Phishing Probability: {phish_prob:.2f}, Is Phishing: {is_phishing}, Confidence: {confidence_value:.2f}")
        
        return jsonify({
            "url": url,
            "is_phishing": bool(is_phishing),
            "confidence": round(float(confidence_value) * 100, 2)
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
        
        # Process in chunks to prevent memory issues with large datasets
        chunk_size = 100
        for idx, url in enumerate(df[url_col]):
            try:
                # Extract features
                extracted_data = get_url_features(str(url))
                
                # Create DataFrame with proper alignment
                input_df = pd.DataFrame([extracted_data])
                
                # Fill missing columns with 0
                for col in feature_names:
                    if col not in input_df.columns:
                        input_df[col] = 0
                
                # Ensure correct column order
                input_df = input_df[feature_names]
                
                # Get prediction
                probs = model.predict_proba(input_df)[0]
                phish_prob = float(probs[1])
                is_phishing = phish_prob > 0.80
                
                if is_phishing:
                    phishing_count += 1
                else:
                    safe_count += 1
                
                results.append({
                    "url": str(url),
                    "is_phishing": bool(is_phishing),
                    "confidence": round(phish_prob * 100, 2)
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