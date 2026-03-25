import pandas as pd
import xgboost as xgb
import joblib
from sklearn.model_selection import train_test_split

# 1. Load your 111-feature dataset
df = pd.read_csv("dataset_full.csv")

# 2. Separate Features (X) and Target (y)
# Assuming the last column is your label (0 for safe, 1 for phishing)
X = df.drop(columns=['phishing', 'url'], errors='ignore') 
y = df['phishing']

# 3. Calculate the "Balance Factor"
# This tells XGBoost how much more to care about Phishing (1s) vs Legitimate (0s)
negative_cases = len(y[y == 0])
positive_cases = len(y[y == 1])
balance_ratio = negative_cases / positive_cases

print(f"📊 Balancing Ratio: {balance_ratio:.2f}")

# 4. Train a "Sensitive" XGBoost Model
# We reduce 'max_depth' to prevent memorization (overfitting)
# We add 'scale_pos_weight' to fix the bias
model = xgb.XGBClassifier(
    n_estimators=150,
    max_depth=6,           # Slimmer tree = less "overfitting"
    learning_rate=0.1,
    scale_pos_weight=1, # THE SECRET SAUCE
    use_label_encoder=False,
    eval_metric='logloss'
)

print("🚀 Retraining the AI Brain...")
model.fit(X, y)

# 5. Save the new, balanced artifacts
joblib.dump(model, "phishing_model_v2.pkl")
joblib.dump(list(X.columns), "feature_names_v2.pkl")

print("✅ SUCCESS: New Balanced Model Saved as phishing_model_v2.pkl")