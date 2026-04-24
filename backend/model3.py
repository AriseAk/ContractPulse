"""
ContractPulse - Flask Backend
Wraps clause_extractor.py pipeline for Next.js frontend consumption.

Run: python app.py
Requires: pip install flask flask-cors python-dotenv groq transformers torch
"""

import os
import sys
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

# ── Add parent directory to path so clause_extractor.py is importable ────────
# Adjust this path to wherever clause_extractor.py lives relative to app.py
EXTRACTOR_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, EXTRACTOR_DIR)

try:
    from clause_extractor import extract_clauses, generate_pairs, load_model3, score_pairs
    EXTRACTOR_AVAILABLE = True
except ImportError as e:
    print(f"[WARN] clause_extractor not found: {e}. Running in mock mode.")
    EXTRACTOR_AVAILABLE = False

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# ── Config ────────────────────────────────────────────────────────────────────
MODEL3_DIR     = os.getenv("MODEL3_DIR", "../model_3")
MAX_LEN        = int(os.getenv("MAX_LEN", "512"))
CONF_THRESHOLD = float(os.getenv("CONF_THRESHOLD", "0.7"))

# Cache model so it's not reloaded on every request
_model_cache = {}


def get_model():
    if not _model_cache:
        pipe, tokenizer = load_model3(MODEL3_DIR, MAX_LEN)
        _model_cache["pipe"] = pipe
        _model_cache["tokenizer"] = tokenizer
    return _model_cache["pipe"], _model_cache["tokenizer"]


# ── Mock data for development (when extractor unavailable) ────────────────────
MOCK_RESPONSE = {
    "clauses_a": [
        {"clause_type": "termination",        "clause_text": "Either party may terminate this agreement for convenience upon 30 days written notice.", "contract": "Contract A"},
        {"clause_type": "warranty",           "clause_text": "Seller warrants all deliverables shall be free from defects for 24 months from acceptance.", "contract": "Contract A"},
        {"clause_type": "dispute_resolution", "clause_text": "All disputes shall be resolved through binding arbitration in New York under AAA rules.", "contract": "Contract A"},
        {"clause_type": "ip_ownership",       "clause_text": "Licensee is granted an exclusive, worldwide, perpetual license to use the Software.", "contract": "Contract A"},
        {"clause_type": "confidentiality",    "clause_text": "Neither party shall disclose Confidential Information to any third party without prior written consent.", "contract": "Contract A"},
        {"clause_type": "governing_law",      "clause_text": "This agreement shall be governed by the laws of Delaware.", "contract": "Contract A"},
    ],
    "clauses_b": [
        {"clause_type": "termination",        "clause_text": "This agreement may only be terminated for cause — material breach uncured for 60 days after notice.", "contract": "Contract B"},
        {"clause_type": "warranty",           "clause_text": "Seller disclaims all warranties, express or implied, including merchantability or fitness for purpose.", "contract": "Contract B"},
        {"clause_type": "dispute_resolution", "clause_text": "Either party may bring suit in any court of competent jurisdiction to resolve disputes.", "contract": "Contract B"},
        {"clause_type": "ip_ownership",       "clause_text": "License granted is non-exclusive, limited to the United States, valid for 12 months only.", "contract": "Contract B"},
        {"clause_type": "confidentiality",    "clause_text": "Confidential Information must not be shared with outside parties unless the disclosing party agrees in writing.", "contract": "Contract B"},
        {"clause_type": "governing_law",      "clause_text": "This agreement is governed by the laws of California.", "contract": "Contract B"},
    ],
    "conflicts": [
        {
            "clause_type": "termination",
            "clause_a": "Either party may terminate this agreement for convenience upon 30 days written notice.",
            "clause_b": "This agreement may only be terminated for cause — material breach uncured for 60 days after notice.",
            "predicted_label": "contradiction",
            "predicted_score": 0.9312,
            "contradiction_score": 0.9312,
            "all_scores": {"contradiction": 0.9312, "entailment": 0.0421, "neutral": 0.0267},
            "token_length": 87,
            "uncertain": False,
        },
        {
            "clause_type": "warranty",
            "clause_a": "Seller warrants all deliverables shall be free from defects for 24 months from acceptance.",
            "clause_b": "Seller disclaims all warranties, express or implied, including merchantability or fitness for purpose.",
            "predicted_label": "contradiction",
            "predicted_score": 0.9741,
            "contradiction_score": 0.9741,
            "all_scores": {"contradiction": 0.9741, "entailment": 0.0159, "neutral": 0.0100},
            "token_length": 72,
            "uncertain": False,
        },
        {
            "clause_type": "dispute_resolution",
            "clause_a": "All disputes shall be resolved through binding arbitration in New York under AAA rules.",
            "clause_b": "Either party may bring suit in any court of competent jurisdiction to resolve disputes.",
            "predicted_label": "contradiction",
            "predicted_score": 0.8823,
            "contradiction_score": 0.8823,
            "all_scores": {"contradiction": 0.8823, "entailment": 0.0712, "neutral": 0.0465},
            "token_length": 65,
            "uncertain": False,
        },
        {
            "clause_type": "ip_ownership",
            "clause_a": "Licensee is granted an exclusive, worldwide, perpetual license to use the Software.",
            "clause_b": "License granted is non-exclusive, limited to the United States, valid for 12 months only.",
            "predicted_label": "contradiction",
            "predicted_score": 0.9567,
            "contradiction_score": 0.9567,
            "all_scores": {"contradiction": 0.9567, "entailment": 0.0281, "neutral": 0.0152},
            "token_length": 68,
            "uncertain": False,
        },
        {
            "clause_type": "governing_law",
            "clause_a": "This agreement shall be governed by the laws of Delaware.",
            "clause_b": "This agreement is governed by the laws of California.",
            "predicted_label": "contradiction",
            "predicted_score": 0.7834,
            "contradiction_score": 0.7834,
            "all_scores": {"contradiction": 0.7834, "entailment": 0.1243, "neutral": 0.0923},
            "token_length": 45,
            "uncertain": False,
        },
        {
            "clause_type": "confidentiality",
            "clause_a": "Neither party shall disclose Confidential Information to any third party without prior written consent.",
            "clause_b": "Confidential Information must not be shared with outside parties unless the disclosing party agrees in writing.",
            "predicted_label": "neutral",
            "predicted_score": 0.5821,
            "contradiction_score": 0.2341,
            "all_scores": {"contradiction": 0.2341, "entailment": 0.1838, "neutral": 0.5821},
            "token_length": 58,
            "uncertain": True,
        },
    ]
}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "extractor_available": EXTRACTOR_AVAILABLE})


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    POST /analyze
    Body: { "contract_a": "...", "contract_b": "..." }
    Returns: { clauses_a, clauses_b, conflicts }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    contract_a = data.get("contract_a", "").strip()
    contract_b = data.get("contract_b", "").strip()

    if not contract_a or not contract_b:
        return jsonify({"error": "Both contract_a and contract_b are required"}), 400

    # ── Dev mode: return mock data ────────────────────────────────────────────
    if not EXTRACTOR_AVAILABLE:
        print("[MOCK] Returning mock analysis data")
        return jsonify(MOCK_RESPONSE)

    # ── Production: run the real pipeline ────────────────────────────────────
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
            print(f"[API] Scoring {len(pairs)} pairs with Model 3...")
            pipe, tokenizer = get_model()
            conflicts = score_pairs(pairs, pipe, tokenizer, MAX_LEN, CONF_THRESHOLD)

        return jsonify({
            "clauses_a": clauses_a,
            "clauses_b": clauses_b,
            "conflicts": conflicts,
        })

    except Exception as e:
        print(f"[ERROR] Pipeline failed: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("\n[ContractPulse Backend] Starting on http://localhost:5000")
    print(f"[ContractPulse Backend] Extractor available: {EXTRACTOR_AVAILABLE}")
    app.run(debug=True, port=5000)