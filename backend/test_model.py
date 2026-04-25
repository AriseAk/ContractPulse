# test_model.py — run with: python test_model.py

import os
from transformers import pipeline, AutoTokenizer

MODEL_PATH = "./model_3"  # adjust if your path is different

print("=" * 50)
print("1. Loading model...")
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    pipe = pipeline(
        "text-classification",
        model=MODEL_PATH,
        tokenizer=tokenizer,
        top_k=None,
        truncation=True,
        max_length=512,
        device=-1
    )
    print("✓ Model loaded successfully")
except Exception as e:
    print(f"✗ Model failed to load: {e}")
    exit(1)

print("\n" + "=" * 50)
print("2. Checking model labels...")
print("Label map:", pipe.model.config.id2label)
# Expected: {0: 'entailment', 1: 'neutral', 2: 'contradiction'}
# Bad:      {0: 'LABEL_0',    1: 'LABEL_1',  2: 'LABEL_2'}

print("\n" + "=" * 50)
print("3. Running test pairs...\n")

test_pairs = [
    {
        "desc": "CLEAR CONTRADICTION (Delaware vs California)",
        "a": "This agreement is governed by the laws of Delaware.",
        "b": "This agreement is governed by the laws of California.",
        "expected": "contradiction"
    },
    {
        "desc": "CLEAR ENTAILMENT (same meaning)",
        "a": "Either party may terminate with 30 days written notice.",
        "b": "The agreement can be ended by either side with 30 days notice.",
        "expected": "entailment"
    },
    {
        "desc": "NEUTRAL (unrelated clauses)",
        "a": "Payment shall be made within 30 days of invoice.",
        "b": "The software is provided as-is without warranty.",
        "expected": "neutral"
    },
]

all_passed = True
for t in test_pairs:
    sep = "</s>" if "roberta" in str(pipe.model.config.model_type).lower() else "[SEP]"
    raw = pipe(f"{t['a']} {sep} {t['b']}")
    if raw and isinstance(raw[0], list):
        raw = raw[0]

    scores = {r["label"]: round(r["score"] * 100, 1) for r in raw}
    best   = max(scores, key=scores.get)
    passed = best.lower() == t["expected"]
    all_passed = all_passed and passed

    print(f"  Test : {t['desc']}")
    print(f"  Scores : {scores}")
    print(f"  Predicted : {best}  |  Expected : {t['expected']}  |  {'✓ PASS' if passed else '✗ FAIL'}")
    print()

print("=" * 50)
print("Model type  :", pipe.model.config.model_type)
print("Max length  :", tokenizer.model_max_length)
print("All passed  :", "✓ YES" if all_passed else "✗ NO — see failures above")