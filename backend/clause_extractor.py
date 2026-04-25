"""
Cross-Contract Clause Extractor and Pair Generator
Uses Groq API (groq.com) for clause extraction
Feeds pairs into Model 3 (NLI conflict detection)

Install: pip install groq
API key: https://console.groq.com
"""

import os
import json
import torch
from groq import Groq
from transformers import pipeline as hf_pipeline, AutoTokenizer
from dotenv import load_dotenv
load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
print("API KEY:", GROQ_API_KEY)
MODEL3_DIR = "../model_3"          # path to your saved Model 3
GROQ_MODEL      = "openai/gpt-oss-120b"       # same model you're already using
MAX_LEN         = 512                          # must match Model 3 training config
CONF_THRESHOLD  = 0.7                         # flag pairs below this as uncertain

CLAUSE_TYPES = [
    "termination",
    "warranty",
    "indemnification",
    "ip_ownership",
    "dispute_resolution",
    "confidentiality",
    "liability_cap",
    "governing_law",
    "payment",
    "non_compete",
    "force_majeure",
    "assignment",
]

# ── Groq client ───────────────────────────────────────────────────────────────

groq_client = Groq(api_key=GROQ_API_KEY)

# ── Step 1: Extract clauses from a single contract ────────────────────────────

EXTRACTION_SYSTEM_PROMPT = """You are a legal clause extraction engine.
Your job is to extract distinct legal clauses from contract text.
You must return ONLY a valid JSON array — no explanation, no markdown fences, no preamble.
Never extract financial covenant clauses with numeric thresholds — those are handled separately."""

EXTRACTION_USER_PROMPT = """Extract all distinct legal clauses from this contract.

For each clause return:
- clause_type: one of [{clause_types}]
- clause_text: the core legal obligation rewritten concisely in 1-2 sentences. Max 60 words. Do NOT copy verbatim.

Rules:
- One entry per clause_type maximum. If duplicates exist, keep the most restrictive.
- Skip purely numeric clauses like "maintain debt ratio >= 2.5" — financial covenants only.
- Skip any clause that does not fit the listed types.

Return format — JSON array only, nothing else:
[
  {{"clause_type": "termination", "clause_text": "Either party may terminate with 30 days written notice."}},
  {{"clause_type": "dispute_resolution", "clause_text": "All disputes resolved through binding arbitration in New York."}}
]

Contract text:
{contract_text}"""


def extract_clauses(contract_text: str, contract_label: str) -> list[dict]:
    """
    Call Groq to extract and classify clauses from one contract.
    Returns list of {clause_type, clause_text, contract} dicts.
    """
    prompt = EXTRACTION_USER_PROMPT.format(
        clause_types=", ".join(CLAUSE_TYPES),
        contract_text=contract_text.strip()
    )

    # Non-streaming — we need the full response before JSON parsing
    completion = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        temperature=0,              # deterministic extraction
        max_completion_tokens=2048,
        top_p=1,
        reasoning_effort="medium",
        stream=False,               # must be False — need full JSON before parsing
        stop=None,
    )

    raw = completion.choices[0].message.content.strip()

    # Strip markdown fences if model adds them anyway
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        clauses = json.loads(raw)
        # Handle if model wraps array in a dict
        if isinstance(clauses, dict):
            clauses = next(iter(clauses.values()))
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON parse failed for {contract_label}: {e}")
        print(f"Raw response was:\n{raw[:400]}")
        return []

    for c in clauses:
        c["contract"] = contract_label

    print(f"\n[{contract_label}] Extracted {len(clauses)} clauses:")
    for c in clauses:
        print(f"  [{c['clause_type']}] {c['clause_text'][:80]}...")

    return clauses


# ── Step 2: Pair same-type clauses across contracts ───────────────────────────

def generate_pairs(
    clauses_a: list[dict],
    clauses_b: list[dict],
) -> list[dict]:
    """
    Match clauses of the same type across Contract A and Contract B.
    Returns list of {clause_type, clause_a, clause_b} dicts.
    """
    index_a = {c["clause_type"]: c["clause_text"] for c in clauses_a}
    index_b = {c["clause_type"]: c["clause_text"] for c in clauses_b}

    matched_types   = set(index_a.keys()) & set(index_b.keys())
    unmatched_types = set(index_a.keys()).symmetric_difference(set(index_b.keys()))

    pairs = [
        {
            "clause_type": clause_type,
            "clause_a":    index_a[clause_type],
            "clause_b":    index_b[clause_type],
        }
        for clause_type in matched_types
    ]

    print(f"\n[PAIRING] {len(pairs)} matching types: {sorted(matched_types)}")
    if unmatched_types:
        print(f"[PAIRING] Only in one contract (skipped): {sorted(unmatched_types)}")

    return pairs


# ── Step 3: Validate token lengths before inference ───────────────────────────

def check_token_length(tokenizer, clause_a: str, clause_b: str, max_len: int) -> int:
    """Returns token count. Warns if truncation will occur."""
    tokens = tokenizer(
        f"{clause_a} [SEP] {clause_b}",
        return_tensors="pt",
        truncation=False,
    )
    length = tokens["input_ids"].shape[1]
    if length > max_len:
        print(f"  [WARN] {length} tokens > MAX_LEN {max_len} — will be truncated")
    elif length > int(max_len * 0.85):
        print(f"  [WARN] {length} tokens is close to limit ({max_len})")
    return length


# ── Step 4: Load and run Model 3 ─────────────────────────────────────────────

def load_model3(model_dir: str, max_len: int):
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    device    = 0 if torch.cuda.is_available() else -1
    pipe = hf_pipeline(
        "text-classification",
        model=model_dir,
        tokenizer=tokenizer,
        device=device,
        top_k=None,
        truncation=True,
        max_length=max_len,
        return_token_type_ids=False  # 🔥 ADD THIS
    )
    print(f"\n[MODEL3] Loaded from '{model_dir}' on {'GPU' if device == 0 else 'CPU'}")
    return pipe, tokenizer


def score_pairs(
    pairs: list[dict],
    pipe,
    tokenizer,
    max_len: int,
    conf_threshold: float,
) -> list[dict]:
    """
    Run Model 3 on each clause pair.
    Returns results sorted: contradictions first, then by confidence descending.
    """
    results = []

    for pair in pairs:
        clause_a    = pair["clause_a"]
        clause_b    = pair["clause_b"]
        clause_type = pair["clause_type"]

        token_len  = check_token_length(tokenizer, clause_a, clause_b, max_len)
        raw_result = pipe(f"{clause_a} [SEP] {clause_b}")

        if raw_result and isinstance(raw_result[0], list):
            raw_result = raw_result[0]

        scores              = {r["label"]: r["score"] for r in raw_result}
        predicted_label     = max(scores, key=scores.get)
        predicted_score     = scores[predicted_label]
        contradiction_score = scores.get("contradiction", 0.0)

        results.append({
            "clause_type":         clause_type,
            "clause_a":            clause_a,
            "clause_b":            clause_b,
            "predicted_label":     predicted_label,
            "predicted_score":     round(predicted_score, 4),
            "contradiction_score": round(contradiction_score, 4),
            "all_scores":          {k: round(v, 4) for k, v in scores.items()},
            "token_length":        token_len,
            "uncertain":           predicted_score < conf_threshold,
        })

    # Contradictions first, then sorted by confidence descending
    results.sort(key=lambda x: (
        x["predicted_label"] != "contradiction",
        -x["predicted_score"],
    ))
# ✅ Keep only strong, reliable contradictions

    return results


# ── Step 5: Print results ─────────────────────────────────────────────────────

def print_results(results: list[dict]):
    # 🔥 Split results
    strong = [
        r for r in results
        if r["predicted_label"] == "contradiction"
        and not r["uncertain"]
        and r["predicted_score"] >= 0.75
    ]

    uncertain = [
        r for r in results
        if r["uncertain"]
    ]

    print("\n" + "=" * 65)
    print("CONTRACT CONFLICT ANALYSIS")
    print("=" * 65)

    # ✅ PRIMARY SECTION
    print("\n── HIGH-CONFIDENCE CONFLICTS ─────────────────────────────")
    print("[INFO] These are reliable contradictions (>= 75%)")

    if strong:
        for r in strong:
            print(f"\n[{r['clause_type'].upper()}] {r['predicted_score']:.2%}")
            print(f"Contract A: {r['clause_a']}")
            print(f"Contract B: {r['clause_b']}")
    else:
        print("  None found.")

    # ⚠️ SECONDARY SECTION
    print("\n── UNCERTAIN / REVIEW NEEDED ─────────────────────────────")
    print("[INFO] Lower-confidence predictions — require human validation")

    if uncertain:
        for r in uncertain:
            print(f"\n[{r['clause_type'].upper()}] "
                  f"{r['predicted_label']} ({r['predicted_score']:.2%})")
            print(f"Contract A: {r['clause_a']}")
            print(f"Contract B: {r['clause_b']}")
    else:
        print("  None.")

    print("\n" + "=" * 65)


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run_pipeline(
    contract_a_text: str,
    contract_b_text: str,
    model3_dir: str       = MODEL3_DIR,
    max_len: int          = MAX_LEN,
    conf_threshold: float = CONF_THRESHOLD,
) -> list[dict]:
    """
    Full pipeline:
      1. Groq extracts + classifies clauses from both contracts
      2. Same-type clauses are paired across contracts
      3. Model 3 scores each pair for contradiction
      4. Results returned sorted by conflict severity
    """
    print("\n── STEP 1: Extracting clauses via Groq ────────────────────")
    clauses_a = extract_clauses(contract_a_text, "Contract A")
    clauses_b = extract_clauses(contract_b_text, "Contract B")

    if not clauses_a or not clauses_b:
        print("[ERROR] Extraction returned empty. Check GROQ_API_KEY and contract text.")
        return []

    print("\n── STEP 2: Generating clause pairs ────────────────────────")
    pairs = generate_pairs(clauses_a, clauses_b)

    if not pairs:
        print("[WARN] No matching clause types between contracts.")
        return []

    print(f"\n── STEP 3: Scoring {len(pairs)} pairs with Model 3 ────────")
    pipe, tokenizer = load_model3(model3_dir, max_len)
    results = score_pairs(pairs, pipe, tokenizer, max_len, conf_threshold)

    print_results(results)
    return results


# ── Example usage ─────────────────────────────────────────────────────────────

if __name__ == "__main__":

    CONTRACT_A = """
    VENDOR AGREEMENT 2024

    Termination: Either party may terminate this agreement for convenience
    upon 30 days written notice to the other party.

    Warranties: Seller warrants that all deliverables shall be free from
    defects for a period of 24 months from the date of acceptance by Buyer.

    Dispute Resolution: All disputes arising under this agreement shall be
    resolved through binding arbitration in New York under AAA rules.

    Intellectual Property: The Licensee is granted an exclusive, worldwide,
    perpetual license to use the Software and all derivative works.

    Confidentiality: Neither party shall disclose Confidential Information
    to any third party without prior written consent of the disclosing party.

    Governing Law: This agreement shall be governed by the laws of Delaware.
    """

    CONTRACT_B = """
    MASTER SERVICES AGREEMENT 2024

    Termination: This agreement may only be terminated for cause, specifically
    material breach that remains uncured for 60 days after written notice.

    Warranties: Seller disclaims all warranties, express or implied, including
    any warranty of merchantability or fitness for a particular purpose.

    Dispute Resolution: Either party may bring suit in any court of competent
    jurisdiction to resolve disputes arising under this agreement.

    Intellectual Property: The license granted herein is non-exclusive, limited
    to the United States, and valid for 12 months only from the effective date.

    Confidentiality: Confidential Information must not be shared with outside
    parties unless the disclosing party agrees in writing beforehand.

    Governing Law: This agreement is governed by the laws of California.
    """

    results = run_pipeline(CONTRACT_A, CONTRACT_B)

    with open("conflict_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nResults saved to conflict_results.json")
