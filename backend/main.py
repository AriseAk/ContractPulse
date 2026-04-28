import os
import sys

# Add project root to path so 'src' package is found
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import io
import pickle
import secrets
import threading
from datetime import datetime, timezone
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
from all_model_code.model_1_code.pipeline import ObligationPipeline
from scheduler_api import scheduler_bp, scheduler, BreachedObligation, ObligationType

# ── clause_extractor (for two-contract comparison) ────────────────────────────
# Adjust EXTRACTOR_DIR if clause_extractor.py lives elsewhere relative to main.py
EXTRACTOR_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, EXTRACTOR_DIR)
try:
    from clause_extractor import extract_clauses, generate_pairs, load_model3, score_pairs
    EXTRACTOR_AVAILABLE = True
except ImportError as e:
    print(f"[WARN] clause_extractor not found: {e}. /api/compare will run in mock mode.")
    EXTRACTOR_AVAILABLE = False

# ─── Load env ─────────────────────────────────────────────────────────────────
load_dotenv()

MONGO_URI        = os.getenv("MONGO_URI")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_SECRET    = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT  = os.getenv("GOOGLE_REDIRECT_URI")
FRONTEND_URL     = os.getenv("FRONTEND_URL", "http://localhost:3000")
SECRET_KEY       = os.getenv("SECRET_KEY", secrets.token_hex(32))
IS_PROD          = os.getenv("FLASK_ENV", "development") == "production"
CONF_THRESHOLD   = float(os.getenv("CONF_THRESHOLD", "0.7"))
MAX_LEN          = int(os.getenv("MAX_LEN", "512"))

# ─── MongoDB ──────────────────────────────────────────────────────────────────
try:
    mongo_client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    _db = mongo_client["userinfo"]
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
# app.secret_key = secrets.token_hex(16)

CORS(
    app,
    origins              = [FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    supports_credentials = True,
    allow_headers        = ["Content-Type", "Authorization"],
    methods              = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)

app.register_blueprint(scheduler_bp)
app.config.update(
    SECRET_KEY              = os.getenv("SECRET_KEY") or secrets.token_hex(32),
    SESSION_TYPE            = "filesystem",
    SESSION_FILE_DIR        = os.path.join(os.getcwd(), "session_data"),
    SESSION_COOKIE_SAMESITE = "Lax",
    SESSION_COOKIE_SECURE   = IS_PROD,
)
Session(app)

http = httpx.Client()

# ─── Auth helpers ─────────────────────────────────────────────────────────────
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

# ─── Email / Password auth ────────────────────────────────────────────────────

@app.route("/auth/register", methods=["POST"])
def register():
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

    hashed   = generate_password_hash(password)
    user_doc = {
        "name": name, "email": email, "password": hashed,
        "picture": None, "provider": "email", "provider_id": None,
        "created_at": now(), "updated_at": now(),
    }
    result = db().users.insert_one(user_doc)
    session["user_id"]   = str(result.inserted_id)
    session["user_name"] = name
    user_doc["_id"]      = result.inserted_id
    return jsonify({"message": "Account created", "user": serialize_user(user_doc)}), 201


@app.route("/auth/login", methods=["POST"])
def login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user        = db().users.find_one({"email": email, "provider": "email"})
    dummy_hash  = generate_password_hash("__dummy__")
    stored_hash = user["password"] if user else dummy_hash
    valid       = check_password_hash(stored_hash, password)

    if not user or not valid:
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"]   = str(user["_id"])
    session["user_name"] = user.get("name")
    return jsonify({"message": "Logged in", "user": serialize_user(user)})

# ─── Google OAuth ─────────────────────────────────────────────────────────────

@app.route("/auth/login/google")
def google_login():
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state
    params = {
        "client_id": GOOGLE_CLIENT_ID, "redirect_uri": GOOGLE_REDIRECT,
        "response_type": "code", "scope": "openid email profile",
        "state": state, "access_type": "online", "prompt": "select_account",
    }
    return redirect(f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}")


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
            "code": code, "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_SECRET, "redirect_uri": GOOGLE_REDIRECT,
            "grant_type": "authorization_code",
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

    user = db().users.find_one_and_update(
        {"provider_id": info["sub"], "provider": "google"},
        {
            "$set": {"name": info.get("name"), "email": info.get("email"),
                     "picture": info.get("picture"), "updated_at": now()},
            "$setOnInsert": {"provider": "google", "provider_id": info["sub"], "created_at": now()},
        },
        upsert=True,
        return_document=True,
    )

    session["user_id"]   = str(user["_id"])
    session["user_name"] = info.get("name")
    return redirect(f"{FRONTEND_URL}/dashboard")

# ─── Session routes ───────────────────────────────────────────────────────────

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


@app.route("/api/profile")
@require_auth
def profile():
    user = db().users.find_one({"_id": ObjectId(uid())})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(serialize_user(user))

# ─── ML Model Registry (lazy-loaded, thread-safe) ────────────────────────────

_models: dict      = {}
_model_lock        = threading.Lock()
BASE_DIR           = os.path.dirname(os.path.abspath(__file__))
_compare_model_cache: dict = {}   # separate cache for clause_extractor's model3

def _load_obligation_pipeline():
    config = {
        "model_name": os.path.join(BASE_DIR, "ckpt_obligation_fast"),
        "device": "cpu",
        "filter_min_confidence": 0.1,
        "min_fields": 2,
    }
    return ObligationPipeline(config)

def _load_nli_model():
    from transformers import pipeline as hf_pipeline
    path = os.path.join(BASE_DIR, "model_3")
    return hf_pipeline(
        "text-classification", model=path, tokenizer=path,
        device=-1, top_k=None, truncation=True, max_length=128,
    )

def _load_risk_bundle():
    pkl_path = os.path.join(BASE_DIR, "risk_model_v10_extended.pkl")
    with open(pkl_path, "rb") as f:
        return pickle.load(f)

def get_model(key: str):
    if key not in _models:
        with _model_lock:
            if key not in _models:
                print(f"[ML] Loading model: {key} …")
                if key == "obligation":
                    _models[key] = _load_obligation_pipeline()
                elif key == "nli":
                    _models[key] = _load_nli_model()
                elif key == "risk":
                    _models[key] = _load_risk_bundle()
                print(f"[ML] Model '{key}' ready.")
    return _models[key]

def _get_compare_model():
    """Lazy-load clause_extractor's model3 (used by /api/compare)."""
    if not _compare_model_cache:
        pipe, tokenizer = load_model3(os.path.join(BASE_DIR, "model_3"), MAX_LEN)
        _compare_model_cache["pipe"]      = pipe
        _compare_model_cache["tokenizer"] = tokenizer
    return _compare_model_cache["pipe"], _compare_model_cache["tokenizer"]

# ─── PDF / text extraction helper ────────────────────────────────────────────

def extract_text_from_request() -> str:
    if "file" in request.files:
        raw = request.files["file"].read()
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages)
    return (request.get_json(silent=True) or {}).get("text", "")

# ─── COVENANT OBLIGATION EXTRACTION (/api/analyze) ───────────────────────────

@app.route("/api/analyze", methods=["POST"])
# @require_auth   # Uncomment to lock behind auth
def analyze_contract():
    text = extract_text_from_request()

    print("\n" + "=" * 40)
    print("--- 1. INCOMING TEXT TO AI ---")
    print(text[:400].strip() if text else "WARNING: TEXT IS EMPTY!")
    print("=" * 40 + "\n")

    if not text.strip():
        return jsonify({"error": "No contract text provided"}), 400

    pipeline = get_model("obligation")
    try:
        raw_results = pipeline.process(
            source=text, source_type="text", contract_id="api_upload", debug=True
        )
        print("\n" + "=" * 40)
        print("--- 2. RAW PIPELINE OUTPUT ---")
        print(raw_results)
        print("=" * 40 + "\n")

        try:
            from all_model_code.model_1_code.stage1_ingestion import ingest
            from all_model_code.model_1_code.stage2_cleaning import clean_text
            cleaned_text = clean_text(ingest(text, "text"))
        except Exception:
            cleaned_text = text

        obligations = []
        for i, r in enumerate(raw_results):
            metric_name = r.get("metric_name", "Unknown Metric")
            op          = r.get("operator", "must maintain")
            val         = r.get("threshold_value", "a specific value")
            score       = r.get("confidence_score", 0.5)
            risk        = max(5, min(95, round((1 - score) * 80 + 10)))
            obligations.append({
                "id":          f"C{i+1}",
                "clause":      str(metric_name).replace("_", " ").title()[:30],
                "type":        "Financial Covenant",
                "desc":        f"The entity {op} a {metric_name} of {val}.",
                "confidence":  round(score * 100, 1),
                "risk":        risk,
                "source_text": r.get("source_text", ""),
            })

        if not obligations:
            return jsonify({"error": "No strict numerical obligations found."}), 422

        return jsonify({
            "obligations":   obligations,
            "clause_count":  len(obligations),
            "contract_text": cleaned_text,
        })

    except Exception as e:
        print(f"[analyze] Pipeline error: {e}")
        return jsonify({"error": "Failed to process contract through AI pipeline."}), 500

# ─── CROSS-CONTRACT CONFLICT COMPARISON (/api/compare) ───────────────────────
# Uses clause_extractor.py + Groq to extract and compare two full contracts.
# Falls back to mock data when EXTRACTOR_AVAILABLE is False.

MOCK_COMPARE_RESPONSE = {
    "clauses_a": [
        {"clause_type": "termination",        "clause_text": "Either party may terminate this agreement for convenience upon 30 days written notice.",                      "contract": "Contract A"},
        {"clause_type": "warranty",           "clause_text": "Seller warrants all deliverables shall be free from defects for 24 months from acceptance.",                "contract": "Contract A"},
        {"clause_type": "dispute_resolution", "clause_text": "All disputes shall be resolved through binding arbitration in New York under AAA rules.",                   "contract": "Contract A"},
        {"clause_type": "ip_ownership",       "clause_text": "Licensee is granted an exclusive, worldwide, perpetual license to use the Software.",                       "contract": "Contract A"},
        {"clause_type": "confidentiality",    "clause_text": "Neither party shall disclose Confidential Information to any third party without prior written consent.",   "contract": "Contract A"},
        {"clause_type": "governing_law",      "clause_text": "This agreement shall be governed by the laws of Delaware.",                                                 "contract": "Contract A"},
    ],
    "clauses_b": [
        {"clause_type": "termination",        "clause_text": "This agreement may only be terminated for cause — material breach uncured for 60 days after notice.",       "contract": "Contract B"},
        {"clause_type": "warranty",           "clause_text": "Seller disclaims all warranties, express or implied, including merchantability or fitness for purpose.",    "contract": "Contract B"},
        {"clause_type": "dispute_resolution", "clause_text": "Either party may bring suit in any court of competent jurisdiction to resolve disputes.",                   "contract": "Contract B"},
        {"clause_type": "ip_ownership",       "clause_text": "License granted is non-exclusive, limited to the United States, valid for 12 months only.",                "contract": "Contract B"},
        {"clause_type": "confidentiality",    "clause_text": "Confidential Information must not be shared with outside parties unless the disclosing party agrees.",      "contract": "Contract B"},
        {"clause_type": "governing_law",      "clause_text": "This agreement is governed by the laws of California.",                                                    "contract": "Contract B"},
    ],
    "conflicts": [
        {"clause_type": "termination",        "clause_a": "Either party may terminate this agreement for convenience upon 30 days written notice.",             "clause_b": "This agreement may only be terminated for cause — material breach uncured for 60 days after notice.", "predicted_label": "contradiction", "predicted_score": 0.9312, "contradiction_score": 0.9312, "all_scores": {"contradiction": 0.9312, "entailment": 0.0421, "neutral": 0.0267}, "token_length": 87,  "uncertain": False},
        {"clause_type": "warranty",           "clause_a": "Seller warrants all deliverables shall be free from defects for 24 months from acceptance.",        "clause_b": "Seller disclaims all warranties, express or implied, including merchantability or fitness for purpose.",  "predicted_label": "contradiction", "predicted_score": 0.9741, "contradiction_score": 0.9741, "all_scores": {"contradiction": 0.9741, "entailment": 0.0159, "neutral": 0.0100}, "token_length": 72,  "uncertain": False},
        {"clause_type": "dispute_resolution", "clause_a": "All disputes shall be resolved through binding arbitration in New York under AAA rules.",           "clause_b": "Either party may bring suit in any court of competent jurisdiction to resolve disputes.",               "predicted_label": "contradiction", "predicted_score": 0.8823, "contradiction_score": 0.8823, "all_scores": {"contradiction": 0.8823, "entailment": 0.0712, "neutral": 0.0465}, "token_length": 65,  "uncertain": False},
        {"clause_type": "ip_ownership",       "clause_a": "Licensee is granted an exclusive, worldwide, perpetual license to use the Software.",               "clause_b": "License granted is non-exclusive, limited to the United States, valid for 12 months only.",             "predicted_label": "contradiction", "predicted_score": 0.9567, "contradiction_score": 0.9567, "all_scores": {"contradiction": 0.9567, "entailment": 0.0281, "neutral": 0.0152}, "token_length": 68,  "uncertain": False},
        {"clause_type": "governing_law",      "clause_a": "This agreement shall be governed by the laws of Delaware.",                                        "clause_b": "This agreement is governed by the laws of California.",                                                  "predicted_label": "contradiction", "predicted_score": 0.7834, "contradiction_score": 0.7834, "all_scores": {"contradiction": 0.7834, "entailment": 0.1243, "neutral": 0.0923}, "token_length": 45,  "uncertain": False},
        {"clause_type": "confidentiality",    "clause_a": "Neither party shall disclose Confidential Information to any third party without prior written consent.", "clause_b": "Confidential Information must not be shared with outside parties unless the disclosing party agrees.", "predicted_label": "neutral",      "predicted_score": 0.5821, "contradiction_score": 0.2341, "all_scores": {"contradiction": 0.2341, "entailment": 0.1838, "neutral": 0.5821},         "token_length": 58,  "uncertain": True},
    ],
}


@app.route("/api/compare", methods=["POST"])
def compare_contracts():
    """
    POST /api/compare
    Body: { "contract_a": "...", "contract_b": "..." }
    Returns: { clauses_a, clauses_b, conflicts }

    Extracts clauses from both contracts via Groq (clause_extractor.py) then
    scores each matched pair with model_3 for entailment / contradiction.
    Falls back to MOCK_COMPARE_RESPONSE when clause_extractor is unavailable.
    """
    data       = request.get_json(force=True, silent=True) or {}  # force=True ignores Content-Type
    contract_a = (data.get("contract_a") or "").strip()
    contract_b = (data.get("contract_b") or "").strip()

    if not contract_a or not contract_b:
        print(f"[compare] 400 — got keys: {list(data.keys())}, "
              f"a={bool(contract_a)}, b={bool(contract_b)}")
        return jsonify({"error": "Both contract_a and contract_b are required"}), 400

    if not EXTRACTOR_AVAILABLE:
        print("[MOCK] clause_extractor unavailable — returning mock compare data")
        return jsonify(MOCK_COMPARE_RESPONSE)

    try:
        print("\n[API] Extracting clauses via Groq...")
        clauses_a = extract_clauses(contract_a, "Contract A")
        clauses_b = extract_clauses(contract_b, "Contract B")

        if not clauses_a or not clauses_b:
            return jsonify({"error": "Clause extraction returned empty. Check GROQ_API_KEY."}), 500

        print("[API] Generating pairs...")
        pairs = generate_pairs(clauses_a, clauses_b)

        conflicts = []
        if pairs:
            print(f"[API] Scoring {len(pairs)} pairs with model_3...")
            pipe, tokenizer = _get_compare_model()
            conflicts = score_pairs(pairs, pipe, tokenizer, MAX_LEN, CONF_THRESHOLD)

        return jsonify({"clauses_a": clauses_a, "clauses_b": clauses_b, "conflicts": conflicts})

    except Exception as e:
        print(f"[compare] Pipeline error: {e}")
        return jsonify({"error": str(e)}), 500

# ─── SINGLE-CLAUSE NLI (/api/conflicts) ──────────────────────────────────────

@app.route("/api/conflicts", methods=["POST"])
def detect_conflicts():
    """
    POST /api/conflicts
    Body: { "clause1": "...", "clause2": "..." }
    Returns: { label, confidence, scores }
    """
    data    = request.get_json(silent=True) or {}
    clause1 = (data.get("clause1") or "").strip()
    clause2 = (data.get("clause2") or "").strip()

    if not clause1 or not clause2:
        return jsonify({"error": "Both clause1 and clause2 are required"}), 400

    pipe = get_model("nli")
    raw  = pipe(f"{clause1} [SEP] {clause2}")
    if raw and isinstance(raw[0], list):
        raw = raw[0]

    scores = {r["label"]: round(r["score"] * 100, 2) for r in raw}
    best   = max(scores, key=scores.get)
    return jsonify({"label": best, "confidence": scores[best], "scores": scores})

# ─── RISK FORECAST (/api/risk) ────────────────────────────────────────────────

import sys as _sys
_sys.path.insert(0, os.path.abspath(os.path.join(BASE_DIR, '../model_2')))
try:
    from inference_demo import load_ticker_data, build_risk_score
except ImportError:
    print("[!] Warning: Could not import inference_demo from ../model_2")
    def load_ticker_data(ticker, d): raise NotImplementedError("inference_demo not found")
    def build_risk_score(df):        raise NotImplementedError("inference_demo not found")


@app.route("/api/risk", methods=["GET"])
def risk_forecast():
    """GET /api/risk?ticker=AAPL&horizon=90"""
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

    current_risk_raw  = fe['risk_raw'].iloc[-1]
    current_risk_norm = (current_risk_raw - r_min) / (r_max - r_min + 1e-9)

    future   = model.make_future_dataframe(periods=horizon, freq='B')
    forecast = model.predict(future)

    # ── BUG FIX: always use the DatetimeIndex, never the 'Date' column.
    # The 'Date' column can resolve to today on some machines, which makes
    # is_future_or_current False for every row and leaves all yhat = null.
    last_date = pd.to_datetime(fe.index[-1])
    print(f"[DEBUG] last_date={last_date}  fe.shape={fe.shape}")

    future_fc = forecast[forecast['ds'] > last_date]

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
            days_to_breach  = max((rows.iloc[0]['ds'] - last_date).days, 0)
            break

    if breach_detected and breach_date:
        try:
            ob_type    = ObligationType.LIQUIDITY_RATIO if ticker == 'CHK' else ObligationType.REVENUE
            breach_obj = BreachedObligation(
                contract_id=f"AUTO-{ticker}",
                obligation_type=ob_type,
                metric_name="Financial Risk Score",
                threshold_value=round(float(threshold), 2),
                current_value=round(float(current_risk_norm), 2),
                predicted_value=None,
                deadline=breach_date,
                consequence="Covenant Violation Predicted by Prophet Model",
                conflict_with=None,
            )
            scheduler.process_breach(breach_obj)
        except Exception as e:
            print(f"Failed to auto-schedule breach: {e}")

    def norm(val):
        span = r_max - r_min if r_max != r_min else 1
        return round(float(np.clip((val - r_min) / span * 100, 0, 100)), 2)

    # Build a DatetimeIndex-keyed lookup for fast y_norm resolution
    fe_indexed = fe["risk_raw"] if fe.index.dtype == "datetime64[ns]" else fe.set_index(pd.to_datetime(fe.index))["risk_raw"]

    series = []
    for _, row in forecast.iterrows():
        ds_ts               = pd.Timestamp(row["ds"])
        is_future_or_current = ds_ts >= last_date

        # Historical actual value — look up by normalised date key
        y_norm = None
        try:
            y_val  = fe_indexed.loc[ds_ts]
            y_norm = norm(float(y_val))
        except KeyError:
            pass

        series.append({
            "ds":         str(ds_ts.date()),
            "y":          y_norm,
            "yhat":       round(float(np.clip(row["yhat"]       * 100, 0, 100)), 2) if is_future_or_current else None,
            "yhat_lower": round(float(np.clip(row["yhat_lower"] * 100, 0, 100)), 2) if is_future_or_current else None,
            "yhat_upper": round(float(np.clip(row["yhat_upper"] * 100, 0, 100)), 2) if is_future_or_current else None,
            "yhat_range": [
                round(float(np.clip(row["yhat_lower"] * 100, 0, 100)), 2),
                round(float(np.clip(row["yhat_upper"] * 100, 0, 100)), 2),
            ] if is_future_or_current else None,
        })

    return jsonify({
        "ticker":            ticker,
        "available_tickers": list(bundle["models"].keys()),
        "last_update_date":  str(last_date.date()),
        "current_price":     round(fe['Close'].iloc[-1], 2),
        "risk_metrics": {
            "current_score":      round(current_risk_norm, 4),
            "danger_threshold":   round(threshold, 4),
            "is_in_danger_zone":  bool(current_risk_norm > threshold),
        },
        "forecast": {
            "breach_predicted":         breach_detected,
            "estimated_days_to_breach": days_to_breach,
            "confidence_level":         confidence,
        },
        # Legacy flat keys kept for frontend backward-compat
        "breach_detected":  breach_detected,
        "breach_date":      breach_date,
        "days_to_breach":   days_to_breach,
        "confidence_tier":  confidence,
        "risk_score":       round(current_risk_norm * 100, 2),
        "threshold":        round(float(threshold * 100), 2),
        "forecast_series":  series,
        "model_meta": {
            "run_date":         str(last_date.date()),
            "horizon_days":     horizon,
            "target_threshold": round(float(threshold * 100), 2),
        },
    })


@app.route("/api/risk/all", methods=["GET"])
def get_all():
    import json
    mock_path = os.path.join(BASE_DIR, '../model_2/frontend_mock_api.json')
    if os.path.exists(mock_path):
        with open(mock_path) as f:
            return jsonify(json.load(f))
    return jsonify({"error": "frontend_mock_api.json not found"}), 404


@app.route("/api/risk/tickers", methods=["GET"])
def risk_tickers():
    bundle = get_model("risk")
    return jsonify({"tickers": list(bundle["models"].keys())})

# ─── Health check ─────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok", "extractor_available": EXTRACTOR_AVAILABLE})

# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    os.makedirs("session_data", exist_ok=True)
    # Disable watchdog reloader on Windows — causes WinError 10038 when
    # ML model directories are watched. Debug logging stays active.
    use_reloader = sys.platform != "win32" and not IS_PROD
    app.run(debug=not IS_PROD, port=5000, use_reloader=use_reloader, threaded=True)