"""
Smoke Test — End-to-End Pipeline Verification
==============================================
Runs the full pipeline on a single CUAD test contract to verify
every stage works correctly.

Memory Safety:
    - Uses only 2 chunks for QA detection
    - Shares a single model instance (no duplicate loading)
    - Explicitly frees memory between stages
"""

import gc
import json
import logging
import sys
import os

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("smoke_test")

def main():
    # ─── Test Stages 1-3 independently first ────────────────────────────
    print("=" * 60)
    print("SMOKE TEST: Stage 1-3 (Ingestion → Cleaning → Segmentation)")
    print("=" * 60)
    
    # Load one contract from test data
    with open("data/test.json", "r", encoding="utf-8") as f:
        test_data = json.load(f)
    
    article = test_data["data"][0]
    title = article["title"]
    context = article["paragraphs"][0]["context"]
    
    # Free the rest of the test data — we only need the first contract
    del test_data
    gc.collect()
    
    print(f"\nContract: {title}")
    print(f"Raw text length: {len(context)} chars")
    
    # Stage 1: Ingestion
    from all_model_code.model_1_code.stage1_ingestion import ingest
    raw = ingest(context, source_type="text")
    print(f"\n✓ Stage 1 (Ingestion): {len(raw)} chars")
    
    # Stage 2: Cleaning
    from all_model_code.model_1_code.stage2_cleaning import clean_text
    cleaned = clean_text(raw)
    print(f"✓ Stage 2 (Cleaning): {len(cleaned)} chars (reduced by {len(raw)-len(cleaned)})")
    
    # Stage 3: Segmentation
    from all_model_code.model_1_code.stage3_segmentation import segment_text
    chunks = segment_text(cleaned)
    print(f"✓ Stage 3 (Segmentation): {len(chunks)} chunks")
    
    # Show chunk stats
    lengths = [len(c.text) for c in chunks]
    print(f"  Chunk lengths: min={min(lengths)}, max={max(lengths)}, avg={sum(lengths)/len(lengths):.0f}")
    print(f"  Sample chunk (first): {chunks[0].text[:100]}...")
    if len(chunks) > 5:
        print(f"  Sample chunk (5th): {chunks[4].text[:100]}...")
    
    # Free raw/cleaned text — not needed anymore
    del raw, cleaned, context
    gc.collect()
    
    # ─── Test Stage 4: QA Detection ────────────────────────────────────
    print("\n" + "=" * 60)
    print("SMOKE TEST: Stage 4 (QA Detection) — using 2 chunks only")
    print("=" * 60)
    
    from all_model_code.model_1_code.stage4_qa_detection import QAClauseDetector, OBLIGATION_QUESTIONS
    
    # Use only first 2 chunks to keep memory low
    test_chunks = chunks[:2]
    
    detector = QAClauseDetector(
        model_name="ckpt_obligation_fast",
        device="auto",  # auto-detect RTX 4050
        confidence_threshold=0.01,  # low threshold for smoke test
    )
    
    detections = detector.detect_in_chunks(test_chunks, show_progress=False)
    print(f"\n✓ Stage 4 (QA Detection): {len(detections)} detections from {len(test_chunks)} chunks")
    
    for d in detections[:5]:
        print(f"  [{d.question_type}] conf={d.confidence:.3f}: {d.span_text[:80]}...")
    
    # ─── Test Stage 5: Span Filtering ──────────────────────────────────
    print("\n" + "=" * 60)
    print("SMOKE TEST: Stage 5 (Span Filtering)")
    print("=" * 60)
    
    from all_model_code.model_1_code.stage5_span_filter import filter_spans
    
    filtered = filter_spans(detections, min_confidence=0.01)
    print(f"✓ Stage 5 (Filtering): {len(detections)} → {len(filtered)} spans")
    
    for f_item in filtered[:5]:
        print(f"  [{f_item.question_type}] conf={f_item.confidence:.3f}: {f_item.span_text[:80]}...")
    
    # ─── Test Stage 6: Extraction ──────────────────────────────────────
    print("\n" + "=" * 60)
    print("SMOKE TEST: Stage 6 (Information Extraction)")
    print("=" * 60)
    
    from all_model_code.model_1_code.stage6_extraction import extract_obligations
    
    obligations = extract_obligations(filtered)
    print(f"✓ Stage 6 (Extraction): {len(obligations)} obligations")
    
    for o in obligations[:5]:
        print(f"  metric={o.metric_name}, op={o.operator}, "
              f"val={o.threshold_value}, deadline={o.deadline}")
        print(f"    source: {o.source_text[:80]}...")
    
    # ─── Test Stage 7: Normalize & Validate ────────────────────────────
    print("\n" + "=" * 60)
    print("SMOKE TEST: Stage 7 (Normalization & Validation)")
    print("=" * 60)
    
    from all_model_code.model_1_code.stage7_normalize import normalize_and_validate
    
    results = normalize_and_validate(obligations, min_fields=1)
    print(f"✓ Stage 7 (Normalize): {len(obligations)} → {len(results)} validated")
    
    print("\n" + "=" * 60)
    print("FINAL JSON OUTPUT")
    print("=" * 60)
    print(json.dumps(results, indent=2))
    
    # ─── Unload the first model before loading a new pipeline instance ─
    detector.unload_model()
    del detector, detections, filtered, obligations
    gc.collect()
    
    # ─── Test Full Pipeline ────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("SMOKE TEST: Full Pipeline (all stages combined)")
    print("=" * 60)
    
    from all_model_code.model_1_code.pipeline import ObligationPipeline
    
    pipeline = ObligationPipeline({
        "model_name": "ckpt_obligation_fast",
        "device": "auto",  # auto-detect RTX 4050
        "filter_min_confidence": 0.01,
        "min_fields": 1,
        "max_chunk_chars": 1500,
    })
    
    # Process just first 2 chunks worth of text to keep it fast
    short_text = "\n\n".join(c.text for c in chunks[:2])
    
    pipeline_results = pipeline.process(
        source=short_text,
        source_type="text",
        contract_id=title,
        debug=True,
    )
    
    debug = pipeline.get_debug_info()
    print(f"\n✓ Full pipeline complete!")
    print(f"  Debug: {json.dumps(debug, indent=2)}")
    print(f"  Results: {len(pipeline_results)} obligations")
    print(f"\n  Output:\n{json.dumps(pipeline_results, indent=2)}")
    
    # Clean up
    pipeline.detector.unload_model() if pipeline.detector else None
    del pipeline
    gc.collect()
    
    print("\n" + "=" * 60)
    print("✅ ALL SMOKE TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
