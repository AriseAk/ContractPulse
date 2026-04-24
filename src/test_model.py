import json
from src.pipeline import ObligationPipeline


def run_test():
    # ─── Sample contract (you can replace this later) ───
    sample_contract = """
    The Borrower shall maintain at all times a Debt-to-Equity Ratio of not more than 2.5 to 1.0, tested quarterly.
    Failure to maintain this ratio shall constitute an event of default.

    The Company shall maintain minimum annual gross revenue of at least $5,000,000 during each contract year.

    The Vendor shall obtain and maintain commercial general liability insurance with a minimum coverage amount of $2,000,000.
    """

    # ─── Initialize pipeline ───
    config = {
        "model_name": "ckpt_obligation_fast",
        "device": "cpu",
        "filter_min_confidence": 0.4,
        "min_fields": 2
    }

    pipeline = ObligationPipeline(config)

    print("\n" + "=" * 60)
    print("RUNNING OBLIGATION EXTRACTION TEST")
    print("=" * 60)

    # ─── Run pipeline ───
    results = pipeline.process(
        source=sample_contract,
        source_type="text",
        contract_id="demo_contract",
        debug=False
    )

    # ─── Clean display ───
    cleaned_results = []

    for r in results:
        cleaned = {
            "metric": r.get("metric_name"),
            "operator": r.get("operator"),
            "value": r.get("threshold_value"),
            "deadline": r.get("deadline"),
            "consequence": r.get("consequence"),
            "confidence": round(r.get("confidence_score", 0), 3)
        }
        cleaned = {k: v for k, v in cleaned.items() if v is not None}
        cleaned_results.append(cleaned)

    # ─── Deduplicate: same metric + same value → keep highest confidence ───
    seen = {}
    for obligation in cleaned_results:
        key = (obligation.get("metric"), obligation.get("value"))
        if key not in seen:
            seen[key] = obligation
        else:
            if obligation.get("confidence", 0) > seen[key].get("confidence", 0):
                seen[key] = obligation

    deduplicated_results = list(seen.values())

    print("\nExtracted Obligations:\n")
    print(json.dumps(deduplicated_results, indent=2))

    print("\nTotal Obligations Found:", len(deduplicated_results))


if __name__ == "__main__":
    run_test()