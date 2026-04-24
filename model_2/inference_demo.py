import os
import pickle
import pandas as pd
from datetime import datetime
import yfinance as yf

# ═════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═════════════════════════════════════════════════════════════════════════════
MODEL_PATH = 'risk_model_v10_extended.pkl'
DATA_DIR   = '../data/Stocks'
FORECAST_PERIODS = 90

# ═════════════════════════════════════════════════════════════════════════════
# 1. CORE PIPELINE FUNCTIONS (Required for Frontend/Backend to use the model)
# ═════════════════════════════════════════════════════════════════════════════
def load_ticker_data(ticker, data_dir=None):
    """
    Dynamically fetches historical data from Yahoo Finance.
    Bypasses local CSV files completely.
    """
    print(f"[Data] Fetching live market data for {ticker.upper()}...")
    
    # Download 2 years of daily data
    stock = yf.Ticker(ticker.upper())
    df = stock.history(period="2y")
    
    if df.empty:
        raise ValueError(f"Data for {ticker} not found on Yahoo Finance.")
        
    # Reset index so 'Date' becomes a column
    df = df.reset_index()
    
    # Ensure the Date column is localized properly for Prophet
    if df['Date'].dt.tz is not None:
        df['Date'] = df['Date'].dt.tz_localize(None)
        
    return df

def build_risk_score(df: pd.DataFrame) -> pd.DataFrame:
    """Feature engineering logic (must perfectly match the training phase)."""
    fe = df.copy()
    fe['returns']    = fe['Close'].pct_change()
    fe['vol_14']     = fe['returns'].rolling(14).std()
    fe['momentum']   = fe['Close'] / fe['Close'].rolling(14).mean()
    fe['drawdown']   = fe['Close'] / fe['Close'].cummax()
    fe['returns_5d'] = fe['returns'].rolling(5).mean()
    fe['risk_raw'] = -fe['returns_5d'] + fe['vol_14'] * 2 + (1 - fe['drawdown'])
    fe.dropna(inplace=True)
    return fe[['Close', 'Volume', 'returns', 'vol_14', 'momentum', 'drawdown', 'returns_5d', 'risk_raw']]

# ═════════════════════════════════════════════════════════════════════════════
# 2. INFERENCE SCRIPT
# ═════════════════════════════════════════════════════════════════════════════
def run_inference():
    if not os.path.exists(MODEL_PATH):
        print(f"[!] Could not find {MODEL_PATH}!")
        print("Please run the final cell in your Jupyter Notebook first to generate this file.")
        return

    print(f"[+] Loading model artifact: {MODEL_PATH}")
    with open(MODEL_PATH, 'rb') as f:
        artifact = pickle.load(f)
    
    print(f"Artifact Version: {artifact['version']} (Exported: {artifact['export_date']})")
    tickers = list(artifact['models'].keys())
    print(f"Models available for {len(tickers)} companies: {tickers}\n")

    frontend_data = {}

    for ticker in tickers:
        print(f"[*] Analyzing {ticker}...")
        try:
            # 1. Load & Engineer Data
            df = load_ticker_data(ticker.lower(), DATA_DIR)
            fe = build_risk_score(df)
            
            # 2. Retrieve the specific model & scaler bounds from the artifact
            ticker_payload = artifact['models'][ticker]
            model     = ticker_payload['model']
            r_min     = ticker_payload['r_min']
            r_max     = ticker_payload['r_max']
            threshold = ticker_payload['threshold']
            
            # 3. Normalise using the loaded bounds
            def norm_apply(series):
                return (series - r_min) / (r_max - r_min + 1e-9)
            
            current_risk_raw = fe['risk_raw'].iloc[-1]
            current_risk_norm = norm_apply(current_risk_raw)
            
            # 4. Forecast using loaded Prophet model
            future = model.make_future_dataframe(periods=FORECAST_PERIODS, freq='B')
            forecast = model.predict(future)
            
            # 5. Detect Breach
            last_date = fe.index[-1]
            future_fc = forecast[forecast['ds'] > pd.Timestamp(last_date)]
            
            breach_detected = False
            days_to_breach = None
            confidence = "NONE"
            
            for conf, col in [('HIGH', 'yhat_lower'), ('MEDIUM', 'yhat'), ('LOW', 'yhat_upper')]:
                rows = future_fc[future_fc[col] > threshold]
                if not rows.empty:
                    breach_detected = True
                    confidence = conf
                    days_to_breach = max((rows.iloc[0]['ds'] - pd.Timestamp(last_date)).days, 0)
                    break
            
            # 6. Package cleanly for the frontend
            frontend_data[ticker] = {
                "last_update_date": str(last_date.date()),
                "current_price": round(fe['Close'].iloc[-1], 2),
                "risk_metrics": {
                    "current_score": round(current_risk_norm, 4),
                    "danger_threshold": round(threshold, 4),
                    "is_in_danger_zone": bool(current_risk_norm > threshold)
                },
                "forecast": {
                    "breach_predicted": breach_detected,
                    "estimated_days_to_breach": days_to_breach,
                    "confidence_level": confidence
                }
            }
            print(f"   [OK] Done. Score: {round(current_risk_norm, 4)} | Breach: {'YES' if breach_detected else 'NO'}")
            
        except Exception as e:
            print(f"   [ERROR] Failed to process {ticker}: {e}")

    # ═════════════════════════════════════════════════════════════════════════════
    # 3. MOCK FRONTEND API RESPONSE
    # ═════════════════════════════════════════════════════════════════════════════
    print("\n" + "="*80)
    print("[*] FRONTEND JSON PAYLOAD GENERATED")
    print("="*80)
    import json
    print(json.dumps(frontend_data, indent=2))
    
    # Save to a JSON file for the frontend devs to view
    with open('frontend_mock_api.json', 'w') as f:
        json.dump(frontend_data, f, indent=2)
    print("\n[OK] Saved full response to 'frontend_mock_api.json'")

if __name__ == "__main__":
    run_inference()
