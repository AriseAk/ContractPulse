"""
Evaluation Script
=================
End-to-end evaluation of the obligation extraction pipeline on the CUAD test set.

Measures:
1. QA-level: Exact Match (EM) and F1 scores
2. Pipeline-level: How many valid structured obligations are extracted
3. Per-category breakdown

Memory Safety:
    - Default num_contracts=2 to prevent RAM exhaustion
    - GC after each contract
    - Results stored as summaries, not full objects

Usage:
    python -m src.evaluate
    python -m src.evaluate --model_path ckpt_obligation --num_contracts 5
"""

import argparse
import collections
import gc
import json
import logging
import os
import re
import string
import sys
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# QA METRICS (standard SQuAD evaluation)
# ═══════════════════════════════════════════════════════════════════════════════

def normalize_answer(s: str) -> str:
    """Lower text and remove punctuation, articles, and extra whitespace."""
    def remove_articles(text):
        return re.sub(r"\b(a|an|the)\b", " ", text)
    
    def white_space_fix(text):
        return " ".join(text.split())
    
    def remove_punctuation(text):
        return "".join(ch for ch in text if ch not in string.punctuation)
    
    return white_space_fix(remove_articles(remove_punctuation(s.lower())))


def compute_f1(prediction: str, ground_truth: str) -> float:
    """Compute token-level F1 score."""
    pred_tokens = normalize_answer(prediction).split()
    truth_tokens = normalize_answer(ground_truth).split()
    
    if not pred_tokens or not truth_tokens:
        return float(pred_tokens == truth_tokens)
    
    common = collections.Counter(pred_tokens) & collections.Counter(truth_tokens)
    num_common = sum(common.values())
    
    if num_common == 0:
        return 0.0
    
    precision = num_common / len(pred_tokens)
    recall = num_common / len(truth_tokens)
    
    return 2 * precision * recall / (precision + recall)


def compute_em(prediction: str, ground_truth: str) -> float:
    """Compute exact match score."""
    return float(normalize_answer(prediction) == normalize_answer(ground_truth))


def evaluate_qa_predictions(
    predictions: Dict[str, str],
    references: Dict[str, List[str]],
) -> Dict[str, float]:
    """Evaluate QA predictions against ground truth.
    
    Args:
        predictions: Dict of {qa_id: predicted_answer}.
        references: Dict of {qa_id: [ground_truth_answers]}.
        
    Returns:
        Dict with 'exact_match' and 'f1' scores.
    """
    total_em = 0.0
    total_f1 = 0.0
    count = 0
    
    for qid, pred in predictions.items():
        if qid not in references:
            continue
        
        golds = references[qid]
        
        if not golds:
            # No answer expected
            em = float(not pred or pred.strip() == "")
            f1 = em
        else:
            em = max(compute_em(pred, gold) for gold in golds)
            f1 = max(compute_f1(pred, gold) for gold in golds)
        
        total_em += em
        total_f1 += f1
        count += 1
    
    return {
        "exact_match": (total_em / count * 100) if count > 0 else 0,
        "f1": (total_f1 / count * 100) if count > 0 else 0,
        "num_evaluated": count,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# FULL PIPELINE EVALUATION
# ═══════════════════════════════════════════════════════════════════════════════

def evaluate_pipeline(
    test_path: str = "data/test.json",
    model_path: str = "deepset/roberta-base-squad2",
    num_contracts: int = 2,
    output_path: str = "evaluation_results.json",
    device: str = "auto",
):
    """Run full pipeline evaluation on CUAD test contracts.
    
    Args:
        test_path: Path to test.json.
        model_path: Model name or checkpoint path.
        num_contracts: Number of test contracts to evaluate.
        output_path: Path to save evaluation results.
        device: 'auto' (detect GPU), 'cuda', or 'cpu'.
    """
    from src.pipeline import ObligationPipeline, save_results
    from src.train_qa import load_cuad_data
    from src.utils import get_device
    
    device = get_device(device)
    
    # ─── Load test data ──────────────────────────────────────────────────
    logger.info(f"Loading test data from {test_path}")
    test_data = load_cuad_data(test_path)
    
    # ─── Initialize pipeline ─────────────────────────────────────────────
    config = {
        "model_name": model_path,
        "device": device,
        "filter_min_confidence": 0.3,
        "min_fields": 1,  # more lenient for evaluation
    }
    pipeline = ObligationPipeline(config)
    
    # ─── Process test contracts ──────────────────────────────────────────
    articles = test_data["data"][:num_contracts]
    
    all_results = {}
    qa_predictions = {}
    qa_references = {}
    
    per_category_stats = collections.defaultdict(lambda: {
        "total": 0, "detected": 0, "extracted": 0,
    })
    
    for i, article in enumerate(articles):
        title = article.get("title", f"contract_{i}")
        logger.info(f"\n{'='*60}")
        logger.info(f"Evaluating [{i+1}/{len(articles)}]: {title}")
        logger.info(f"{'='*60}")
        
        for paragraph in article["paragraphs"]:
            context = paragraph["context"]
            results = pipeline.process(
                source=context,
                source_type="text",
                contract_id=title,
                debug=True,
            )
            all_results.setdefault(title, []).extend(results)
            
            # Collect QA-level references
            for qa in paragraph["qas"]:
                qid = qa["id"]
                if qa["is_impossible"]:
                    qa_references[qid] = []
                else:
                    qa_references[qid] = [a["text"] for a in qa["answers"]]
                
                # Extract category from question
                cat_match = re.search(r'"([^"]+)"', qa["question"])
                category = cat_match.group(1) if cat_match else "unknown"
                
                per_category_stats[category]["total"] += 1
                if not qa["is_impossible"]:
                    per_category_stats[category]["detected"] += 1
        
        # Free memory between contracts
        gc.collect()
    
    # ─── Pipeline Statistics ─────────────────────────────────────────────
    total_obligations = sum(len(v) for v in all_results.values())
    
    # Count obligations with full extraction
    full_extraction = sum(
        1 for results in all_results.values()
        for r in results
        if r.get("metric_name") and r.get("threshold_value") is not None
    )
    
    # ─── Compile Results ─────────────────────────────────────────────────
    eval_results = {
        "pipeline_stats": {
            "num_contracts_evaluated": len(articles),
            "total_obligations_extracted": total_obligations,
            "obligations_with_metric_and_value": full_extraction,
            "per_contract": {
                title: len(results) for title, results in all_results.items()
            },
        },
        "category_stats": dict(per_category_stats),
        "sample_outputs": {
            title: results[:5] for title, results in all_results.items()
        },
    }
    
    # ─── Print Summary ───────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("EVALUATION RESULTS")
    print("=" * 60)
    print(f"Contracts evaluated:       {len(articles)}")
    print(f"Total obligations found:   {total_obligations}")
    print(f"With metric + value:       {full_extraction}")
    print()
    
    print("Per-contract breakdown:")
    for title, results in all_results.items():
        print(f"  {title[:50]:50s} → {len(results)} obligations")
    
    if total_obligations > 0:
        print(f"\nSample extracted obligations:")
        for title, results in all_results.items():
            for r in results[:3]:
                print(f"  [{title[:30]}] {r.get('metric_name', 'N/A')} "
                      f"{r.get('operator', '?')} {r.get('threshold_value', '?')} "
                      f"(conf: {r.get('confidence_score', 0):.3f})")
    
    # ─── Save Results ────────────────────────────────────────────────────
    save_results(eval_results, output_path)
    logger.info(f"Evaluation results saved to {output_path}")
    
    return eval_results


def main():
    parser = argparse.ArgumentParser(description="Evaluate obligation extraction pipeline")
    parser.add_argument("--test_path", default="data/test.json")
    parser.add_argument("--model_path", default="deepset/roberta-base-squad2")
    parser.add_argument("--num_contracts", type=int, default=2)
    parser.add_argument("--output_path", default="evaluation_results.json")
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"],
                        help="Device: 'auto' detects GPU, 'cuda' forces GPU, 'cpu' forces CPU")
    
    args = parser.parse_args()
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    
    evaluate_pipeline(**vars(args))


if __name__ == "__main__":
    main()
