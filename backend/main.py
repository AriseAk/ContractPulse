import os
import secrets
from datetime import datetime, timezone
from functools import wraps

import httpx
from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, session
from flask_cors import CORS
from flask_session import Session
from pymongo import MongoClient
from werkzeug.security import check_password_hash, generate_password_hash

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
    mongo_client = MongoClient(MONGO_URI)
    _db = mongo_client["userinfo"]
    # Unique index on email scoped to email-provider users
    _db.users.create_index("email", unique=True, sparse=True)
    print("Connected to MongoDB")
except Exception as e:
    print(f"MongoDB connection failed: {e}")
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
    query = "&".join(f"{k}={v}" for k, v in params.items())
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
    return redirect(f"{FRONTEND_URL}/home")


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


# ─── Health check ─────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    os.makedirs("session_data", exist_ok=True)
    app.run(debug=not IS_PROD, port=5000)