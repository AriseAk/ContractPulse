import os
import sys

# Add project root to path so 'src' package is found
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import io
import pickle
import secrets
import threading
from datetime import datetime, timezone, timedelta
from functools import wraps

import httpx
import urllib.parse
import numpy as np
import pandas as pd
import pdfplumber
from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, session
from flask_cors import CORS
from flask_session import Session
from pymongo import MongoClient
import certifi
from werkzeug.security import check_password_hash, generate_password_hash
from src.pipeline import ObligationPipeline

# ─── Load env ─────────────────────────────────────────────────────────────────
load_dotenv()

MONGO_URI        = os.getenv("MONGO_URI")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_SECRET    = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT  = os.getenv("GOOGLE_REDIRECT_URI")
FRONTEND_URL     = os.getenv("FRONTEND_URL", "http://localhost:3000")
SECRET_KEY       = os.getenv("SECRET_KEY", secrets.token_hex(32))
IS_PROD          = os.getenv("FLASK_ENV", "development") == "production"

# ─── MongoDB ──────────────────────────────────────────────────────────────────
try:
    mongo_client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    _db = mongo_client["userinfo"]
    # Unique index on email scoped to email-provider users
    _db.users.create_index("email", unique=True, sparse=True)
    print("Connected to MongoDB")
except Exception as e:
    print(f"MongoDB connection failed: {e}")
    if "SSL" in str(e) or "tls" in str(e).lower():
        print("\n" + "!" * 60)
        print("CRITICAL: ATLAS IP WHITELIST BLOCKED!")
        print("MongoDB Atlas enforces IP whitelisting by aggressively dropping")
        print("the TLS/SSL handshake. This 'tls1 alert internal error' means")
        print("your current network IP is not added to your Atlas allowlist.")
        print("Log into MongoDB Atlas -> Security -> Network Access -> Add IP")
        print("!" * 60 + "\n")
    raise

def db():
    return _db

def now():
    return datetime.now(timezone.utc)

# ─── App setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config.update(
    SECRET_KEY              = SECRET_KEY,
    SESSION_TYPE            = "filesystem",
    SESSION_FILE_DIR        = os.path.join(os.getcwd(), "session_data"),
    SESSION_COOKIE_SAMESITE = "Lax",
    SESSION_COOKIE_SECURE   = IS_PROD,
)
Session(app)
CORS(
    app,
    origins              = [FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    supports_credentials = True,
    allow_headers        = ["Content-Type", "Authorization"],
    methods              = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)

http = httpx.Client()

# ─── Helpers ──────────────────────────────────────────────────────────────────
def _load_obligation_pipeline():
    """Load the structured obligation extraction pipeline."""
    config = {
        "model_name": os.path.join(BASE_DIR, "ckpt_obligation_fast"),
        "device": "cpu", # Change to 'cuda' if deploying on a GPU instance
        "filter_min_confidence": 0.1,
        "min_fields": 2
    }
    return ObligationPipeline(config)

def require_auth(fn):
    @wraps(fn)
    def inner(*a, **kw):
        if "user_id" not in session:
            return jsonify({"error": "Not authenticated"}), 401
        return fn(*a, **kw)
    return inner

def uid():
    return session.get("user_id")

def serialize_user(user):
    """Return a safe dict — never exposes the hashed password."""
    return {
        "id":         str(user["_id"]),
        "name":       user.get("name"),
        "email":      user.get("email"),
        "picture":    user.get("picture"),
        "provider":   user.get("provider", "email"),
        "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
    }

# ─── Email / Password ─────────────────────────────────────────────────────────

@app.route("/auth/register", methods=["POST"])
def register():
    """
    POST /auth/register
    Body: { "name": "Alice", "email": "alice@example.com", "password": "hunter2!x" }
    """
    data     = request.get_json(silent=True) or {}
    name     = (data.get("name") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not email or "@" not in email:
        return jsonify({"error": "A valid email is required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if db().users.find_one({"email": email, "provider": "email"}):
        return jsonify({"error": "An account with that email already exists"}), 409

    hashed = generate_password_hash(password)   # pbkdf2:sha256 by default

    user_doc = {
        "name":        name,
        "email":       email,
        "password":    hashed,
        "picture":     None,
        "provider":    "email",
        "provider_id": None,
        "created_at":  now(),
        "updated_at":  now(),
    }
    result = db().users.insert_one(user_doc)

    session["user_id"]   = str(result.inserted_id)
    session["user_name"] = name

    user_doc["_id"] = result.inserted_id
    return jsonify({
        "message": "Account created",
        "user":    serialize_user(user_doc),
    }), 201


@app.route("/auth/login", methods=["POST"])
def login():
    """
    POST /auth/login
    Body: { "email": "alice@example.com", "password": "hunter2!x" }
    """
    data     = request.get_json(silent=True) or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = db().users.find_one({"email": email, "provider": "email"})

    # Always run check_password_hash even on a missing user to prevent
    # timing-based user enumeration attacks
    dummy_hash   = generate_password_hash("__dummy__")
    stored_hash  = user["password"] if user else dummy_hash
    valid        = check_password_hash(stored_hash, password)

    if not user or not valid:
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"]   = str(user["_id"])
    session["user_name"] = user.get("name")

    return jsonify({
        "message": "Logged in",
        "user":    serialize_user(user),
    })


# ─── Google OAuth ─────────────────────────────────────────────────────────────

@app.route("/auth/login/google")
def google_login():
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state
    params = {
        "client_id":     GOOGLE_CLIENT_ID,
        "redirect_uri":  GOOGLE_REDIRECT,
        "response_type": "code",
        "scope":         "openid email profile",
        "state":         state,
        "access_type":   "online",
        "prompt":        "select_account",
    }
    query = urllib.parse.urlencode(params)
    return redirect(f"https://accounts.google.com/o/oauth2/v2/auth?{query}")


@app.route("/auth/callback/google")
def google_callback():
    if request.args.get("state") != session.pop("oauth_state", None):
        return jsonify({"error": "Invalid state — possible CSRF"}), 400

    code = request.args.get("code")
    if not code:
        return jsonify({"error": "No authorization code returned from Google"}), 400

    token_res = http.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code":          code,
            "client_id":     GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_SECRET,
            "redirect_uri":  GOOGLE_REDIRECT,
            "grant_type":    "authorization_code",
        },
    ).json()

    access_token = token_res.get("access_token")
    if not access_token:
        return jsonify({"error": "Token exchange failed", "detail": token_res}), 400

    info = http.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    ).json()

    if not info.get("sub"):
        return jsonify({"error": "Could not retrieve user info from Google"}), 400

    # Upsert — no password field is ever stored for OAuth users
    user = db().users.find_one_and_update(
        {"provider_id": info["sub"], "provider": "google"},
        {
            "$set": {
                "name":       info.get("name"),
                "email":      info.get("email"),
                "picture":    info.get("picture"),
                "updated_at": now(),
            },
            "$setOnInsert": {
                "provider":    "google",
                "provider_id": info["sub"],
                "created_at":  now(),
            },
        },
        upsert=True,
        return_document=True,
    )

    session["user_id"]   = str(user["_id"])
    session["user_name"] = info.get("name")
    return redirect(f"{FRONTEND_URL}/dashboard")


# ─── Shared session routes ────────────────────────────────────────────────────

@app.route("/auth/me")
def auth_me():
    if "user_id" not in session:
        return jsonify({"authenticated": False}), 200

    user = db().users.find_one({"_id": ObjectId(uid())})
    if not user:
        session.clear()
        return jsonify({"authenticated": False}), 200

    return jsonify({"authenticated": True, "user": serialize_user(user)})


@app.route("/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


# ─── Protected route example ──────────────────────────────────────────────────

@app.route("/api/profile")
@require_auth
def profile():
    user = db().users.find_one({"_id": ObjectId(uid())})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(serialize_user(user))


# ─── ML Model Registry (lazy-loaded, thread-safe) ────────────────────────────

_models: dict = {}
_model_lock = threading.Lock()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def _load_obligation_model():
    """Load ckpt_obligation_fast — RoBERTa QA loaded directly (pipeline registry workaround)."""
    from transformers import AutoModelForQuestionAnswering, AutoTokenizer
    import torch
    path = os.path.join(BASE_DIR, "ckpt_obligation_fast")
    tokenizer = AutoTokenizer.from_pretrained(path)
    model     = AutoModelForQuestionAnswering.from_pretrained(path)
    model.eval()
    return {"model": model, "tokenizer": tokenizer}

def _run_qa(bundle, question: str, context: str) -> dict:
    """Run extractive QA using the model/tokenizer bundle directly."""
    import torch
    import torch.nn.functional as F
    
    tokenizer = bundle["tokenizer"]
    model     = bundle["model"]
    inputs = tokenizer(
        question, context,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True,
    )
    with torch.no_grad():
        outputs = model(**inputs)
    start_logits = outputs.start_logits[0]
    end_logits   = outputs.end_logits[0]

    # Find best non-null span
    start_idx = int(torch.argmax(start_logits))
    end_idx   = int(torch.argmax(end_logits))
    if end_idx < start_idx:
        end_idx = start_idx

    start_prob = float(F.softmax(start_logits, dim=-1)[start_idx])
    end_prob   = float(F.softmax(end_logits,   dim=-1)[end_idx])
    score      = (start_prob + end_prob) / 2

    # If the model predicts the first token (<s> or [CLS]), it means "no answer"
    if start_idx == 0:
        return {"answer": "", "score": score}

    input_ids = inputs["input_ids"][0]
    tokens    = tokenizer.convert_ids_to_tokens(input_ids[start_idx: end_idx + 1])
    answer    = tokenizer.convert_tokens_to_string(tokens).strip()

    # Clean up any leftover special tokens just in case
    answer = answer.replace(tokenizer.cls_token or "<s>", "")
    answer = answer.replace(tokenizer.sep_token or "</s>", "")
    answer = answer.replace(tokenizer.pad_token or "<pad>", "")

    return {"answer": answer.strip(), "score": score}

def _load_nli_model():
    """Load model_3 — DistilBERT NLI for cross-clause conflict detection."""
    from transformers import pipeline as hf_pipeline
    path = os.path.join(BASE_DIR, "model_3")
    return hf_pipeline(
        "text-classification",
        model=path,
        tokenizer=path,
        device=-1,
        top_k=None,
        truncation=True,
        max_length=128,
    )

def _load_risk_bundle():
    """Load risk_model_v10_extended.pkl — dict of per-ticker Prophet models."""
    pkl_path = os.path.join(BASE_DIR, "risk_model_v10_extended.pkl")
    with open(pkl_path, "rb") as f:
        return pickle.load(f)

def get_model(key: str):
    if key not in _models:
        with _model_lock:
            if key not in _models:   # double-checked locking
                print(f"[ML] Loading model: {key} …")
                if key == "obligation":
                    _models[key] = _load_obligation_pipeline()
                elif key == "nli":
                    _models[key] = _load_nli_model()
                elif key == "risk":
                    _models[key] = _load_risk_bundle()
                print(f"[ML] Model '{key}' ready.")
    return _models[key]


# ─── Helper: extract text from uploaded PDF or raw text body ─────────────────

def extract_text_from_request() -> str:
    """Return plain text from either a multipart PDF upload or a JSON body."""
    if "file" in request.files:
        f = request.files["file"]
        raw = f.read()
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages)
    data = request.get_json(silent=True) or {}
    return data.get("text", "")


# ─── COVENANT OBLIGATION CLAUSES ─────────────────────────────────────────────
# Contract obligations we always ask about
COVENANT_QUESTIONS = [
    "What is the Debt to EBITDA ratio requirement?",
    "What is the minimum cash balance requirement?",
    "What is the Interest Coverage Ratio requirement?",
    "What are the reporting obligations?",
    "What are the dividend restriction clauses?",
    "What is the capital expenditure limit?",
    "What are the cross-default provisions?",
    "What are the minimum revenue covenants?",
]

CLAUSE_TYPE_MAP = {
    0: "Financial Covenant",
    1: "Financial Covenant",
    2: "Financial Covenant",
    3: "Reporting Obligation",
    4: "Restriction Covenant",
    5: "Financial Covenant",
    6: "Cross-Default Clause",
    7: "Financial Covenant",
}


@app.route("/api/analyze", methods=["POST"])
@require_auth # Optional: if you want to lock this to logged-in users
def analyze_contract():
    text = extract_text_from_request()
    
    print("\n" + "="*40)
    print("--- 1. INCOMING TEXT TO AI ---")
    print(text[:400].strip() if text else "WARNING: TEXT IS EMPTY!")
    print("="*40 + "\n")

    if not text.strip():
        return jsonify({"error": "No contract text provided"}), 400

    pipeline = get_model("obligation")
    
    try:
        raw_results = pipeline.process(
            source=text,
            source_type="text",
            contract_id="api_upload",
            debug=True
        )

        print("\n" + "="*40)
        print("--- 2. RAW PIPELINE OUTPUT ---")
        print(raw_results)
        print("="*40 + "\n")

        # 3. Temporarily disabled ALL strict filtering. 
        # If the model finds *anything*, we will send it to the frontend.
        obligations = []
        for i, r in enumerate(raw_results):
            metric_name = r.get("metric_name", "Unknown Metric")
            op = r.get("operator", "must maintain")
            val = r.get("threshold_value", "a specific value")
            
            desc = f"The entity {op} a {metric_name} of {val}."
            score = r.get("confidence_score", 0.5)
            risk = max(5, min(95, round((1 - score) * 80 + 10)))

            obligations.append({
                "id":         f"C{i+1}",
                "clause":     str(metric_name).replace("_", " ").title()[:30],
                "type":       "Financial Covenant",
                "desc":       desc,
                "confidence": round(score * 100, 1),
                "risk":       risk,
            })

        if not obligations:
            return jsonify({"error": "No strict numerical obligations found."}), 422

        return jsonify({"obligations": obligations, "clause_count": len(obligations)})

    except Exception as e:
        print(f"[analyze] Pipeline error: {e}")
        return jsonify({"error": "Failed to process contract through AI pipeline."}), 500


# ─── CROSS-CLAUSE CONFLICT DETECTION ─────────────────────────────────────────

@app.route("/api/conflicts", methods=["POST"])
def detect_conflicts():
    """
    POST /api/conflicts
    Body: { "clause1": "...", "clause2": "..." }
    Returns: { label, confidence, scores: {entailment, contradiction, neutral} }
    """
    data = request.get_json(silent=True) or {}
    clause1 = (data.get("clause1") or "").strip()
    clause2 = (data.get("clause2") or "").strip()

    if not clause1 or not clause2:
        return jsonify({"error": "Both clause1 and clause2 are required"}), 400

    pipe = get_model("nli")
    text = f"{clause1} [SEP] {clause2}"
    raw  = pipe(text)

    # raw is a list of dicts [{"label": ..., "score": ...}]
    if raw and isinstance(raw[0], list):
        raw = raw[0]

    scores = {r["label"]: round(r["score"] * 100, 2) for r in raw}
    best   = max(scores, key=scores.get)

    return jsonify({
        "label":      best,
        "confidence": scores[best],
        "scores":     scores,
    })


# ─── RISK FORECAST (Prophet time-series + model_2 script matching) ─────────────

import sys
sys.path.insert(0, os.path.abspath(os.path.join(BASE_DIR, '../model_2')))
try:
    from inference_demo import load_ticker_data, build_risk_score
except ImportError:
    print("[!] Warning: Could not import inference_demo from ../model_2")
    def load_ticker_data(ticker, d): raise NotImplementedError("inference_demo not found")
    def build_risk_score(df): raise NotImplementedError("inference_demo not found")

@app.route("/api/risk", methods=["GET"])
def risk_forecast():
    """
    GET /api/risk?ticker=AAPL
    """
    ticker  = (request.args.get("ticker") or "AAPL").upper()
    horizon = int(request.args.get("horizon", 90))

    bundle = get_model("risk")
    if ticker not in bundle["models"]:
        return jsonify({"error": f"{ticker} not in model"}), 404

    try:
        df = load_ticker_data(ticker.lower(), os.path.join(BASE_DIR, '../data/Stocks'))
        fe = build_risk_score(df)
    except Exception as e:
        return jsonify({"error": f"Failed to engineer features: {e}"}), 500

    payload   = bundle["models"][ticker]
    model     = payload["model"]
    r_min     = payload["r_min"]
    r_max     = payload["r_max"]
    threshold = payload["threshold"]

    # Normalise current risk
    current_risk_raw  = fe['risk_raw'].iloc[-1]
    current_risk_norm = (current_risk_raw - r_min) / (r_max - r_min + 1e-9)

    # Forecast
    future   = model.make_future_dataframe(periods=horizon, freq='B')
    forecast = model.predict(future)

    if 'Date' in fe.columns:
        last_date = pd.to_datetime(fe['Date'].iloc[-1])
    else:
        last_date = pd.to_datetime(fe.index[-1])
    future_fc = forecast[forecast['ds'] > pd.Timestamp(last_date)]

    breach_detected = False
    days_to_breach  = None
    confidence      = "NONE"
    breach_date     = None

    for conf, col in [('HIGH', 'yhat_lower'), ('MEDIUM', 'yhat'), ('LOW', 'yhat_upper')]:
        rows = future_fc[future_fc[col] > threshold]
        if not rows.empty:
            breach_detected = True
            confidence      = conf
            breach_date     = str(rows.iloc[0]['ds'].date())
            days_to_breach  = max((rows.iloc[0]['ds'] - pd.Timestamp(last_date)).days, 0)
            break

    # Build forecast series chart payload so the Recharts UI doesn't break
    def norm(val):
        span = r_max - r_min if r_max != r_min else 1
        return round(float(np.clip((val - r_min) / span * 100, 0, 100)), 2)

    series = []
    for _, row in forecast.iterrows():
        ds_val   = pd.Timestamp(row["ds"]).date()
        # Find actual y in historical if exists
        try:
            y_val = fe.loc[row["ds"], "risk_raw"]
            y_norm = norm(y_val)
        except KeyError:
            y_norm = None
            
        series.append({
            "ds":          str(ds_val),
            "y":           y_norm,
            "yhat":        norm(row["yhat"]),
            "yhat_lower":  norm(row["yhat_lower"]),
            "yhat_upper":  norm(row["yhat_upper"]),
        })

    return jsonify({
        "ticker": ticker,
        "available_tickers": list(bundle["models"].keys()),
        "last_update_date": str(last_date.date()),
        "current_price": round(fe['Close'].iloc[-1], 2),
        "risk_metrics": {
            "current_score":    round(current_risk_norm, 4),
            "danger_threshold": round(threshold, 4),
            "is_in_danger_zone": bool(current_risk_norm > threshold)
        },
        "forecast": {
            "breach_predicted":        breach_detected,
            "estimated_days_to_breach": days_to_breach,
            "confidence_level":         confidence
        },
        # Legacy mapping for forecast dashboard charts
        "breach_detected": breach_detected,
        "breach_date": breach_date,
        "days_to_breach": days_to_breach,
        "confidence_tier": confidence,
        "risk_score": round(current_risk_norm * 100, 2),
        "threshold": round(norm(threshold), 2),
        "forecast_series": series,
        "model_meta": {
            "run_date": str(last_date.date()),
            "horizon_days": horizon,
            "target_threshold": norm(threshold)
        }
    })

@app.route("/api/risk/all", methods=["GET"])
def get_all():
    """Serves the frontend_mock_api precomputed structure for all tickers"""
    import json
    mock_path = os.path.join(BASE_DIR, '../model_2/frontend_mock_api.json')
    if os.path.exists(mock_path):
        with open(mock_path) as f:
            return jsonify(json.load(f))
    return jsonify({"error": "frontend_mock_api.json not found"}), 404


@app.route("/api/risk/tickers", methods=["GET"])
def risk_tickers():
    """GET /api/risk/tickers — returns list of available tickers."""
    bundle = get_model("risk")
    return jsonify({"tickers": list(bundle["models"].keys())})


# ─── Health check ─────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    import sys
    os.makedirs("session_data", exist_ok=True)
    # Disable watchdog reloader on Windows — causes WinError 10038 (socket not-a-socket)
    # when ML model directories are being watched. Debug logging is still active.
    use_reloader = sys.platform != "win32" and not IS_PROD
    app.run(debug=not IS_PROD, port=5000, use_reloader=use_reloader, threaded=True)