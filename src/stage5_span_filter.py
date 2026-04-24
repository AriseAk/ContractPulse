"""
Stage 5 — Span Filtering
=========================
Not every QA output is useful.

QA models can hallucinate small spans like "the", "agreement".
We only want meaningful spans that actually contain obligation information.

Filters based on:
  1. Confidence score threshold
  2. Answer length (too short = noise)
  3. Keyword presence (financial terms boost relevance)
  4. Deduplication of overlapping spans

Input:  List of DetectedClause from Stage 4
Output: Filtered list of high-quality clause spans
"""

import logging
import re
from typing import List, Set

from src.stage4_qa_detection import DetectedClause

logger = logging.getLogger(__name__)


# Financial keywords that indicate a span is genuinely relevant
FINANCIAL_KEYWORDS = {
    # Metrics / ratios
    "ratio", "leverage", "coverage", "ebitda", "debt", "equity",
    "revenue", "income", "profit", "margin", "asset", "liability",
    "capital", "net worth", "cash flow", "working capital",
    
    # Operators / conditions
    "exceed", "below", "above", "minimum", "maximum", "at least",
    "no less than", "no more than", "not exceed", "maintain",
    "greater than", "less than", "equal to",
    
    # Values
    "%", "$", "percent", "dollar", "million", "billion", "thousand",
    
    # Time
    "quarterly", "annually", "monthly", "semi-annual", "fiscal",
    "within", "days", "calendar year", "fiscal year",
    
    # Consequences
    "default", "penalty", "termination", "breach", "remediation",
    "cure", "waiver", "acceleration",
    
    # Obligation terms
    "shall", "must", "obligat", "require", "covenant", "commit",
    "undertake", "warrant", "guarantee", "ensure",
}


def has_financial_keywords(text: str, min_keywords: int = 1) -> bool:
    """Check if text contains financial obligation keywords.
    
    Args:
        text: Span text to check.
        min_keywords: Minimum number of keywords required.
        
    Returns:
        True if text contains at least min_keywords financial terms.
    """
    text_lower = text.lower()
    count = sum(1 for kw in FINANCIAL_KEYWORDS if kw in text_lower)
    return count >= min_keywords


def compute_quality_score(clause: DetectedClause) -> float:
    """Compute a quality score combining confidence and keyword relevance.
    
    The quality score is:
      base_score = confidence
      + 0.1 * (number of financial keywords found, capped at 3)
      
    This boosts spans that contain financial terms.
    
    Args:
        clause: A detected clause.
        
    Returns:
        Quality score (0-1+).
    """
    text_lower = clause.span_text.lower()
    keyword_count = sum(1 for kw in FINANCIAL_KEYWORDS if kw in text_lower)
    keyword_bonus = min(keyword_count, 3) * 0.1
    
    return clause.confidence + keyword_bonus


def is_valid_span(
    clause: DetectedClause,
    min_confidence: float = 0.3,
    min_length: int = 10,
    max_length: int = 2000,
) -> bool:
    """Check if a detected clause passes quality filters.
    
    Args:
        clause: Detected clause to validate.
        min_confidence: Minimum confidence threshold.
        min_length: Minimum span length in characters.
        max_length: Maximum span length in characters.
        
    Returns:
        True if the span passes all filters.
    """
    # Filter 1: Confidence
    if clause.confidence < min_confidence:
        return False
    
    # Filter 2: Length (too short = noise like "the", "agreement")
    span_len = len(clause.span_text.strip())
    if span_len < min_length:
        return False
    if span_len > max_length:
        return False
    
    # Filter 3: Not just whitespace/punctuation
    alpha_chars = sum(1 for c in clause.span_text if c.isalpha())
    if alpha_chars < 5:
        return False
    
    return True


def deduplicate_spans(
    clauses: List[DetectedClause],
    overlap_threshold: float = 0.5,
) -> List[DetectedClause]:
    """Remove duplicate or highly overlapping spans.
    
    When multiple questions produce overlapping answers from the same chunk,
    keep only the highest-confidence version.
    
    Args:
        clauses: List of detected clauses (should be from same chunk).
        overlap_threshold: Minimum overlap ratio to consider duplicate.
        
    Returns:
        Deduplicated list.
    """
    if len(clauses) <= 1:
        return clauses
    
    # Sort by confidence (descending)
    sorted_clauses = sorted(clauses, key=lambda c: c.confidence, reverse=True)
    
    kept = []
    for clause in sorted_clauses:
        is_duplicate = False
        for existing in kept:
            # Check if same chunk
            if clause.chunk_id != existing.chunk_id:
                continue
            
            # Check character overlap
            start1, end1 = clause.start_in_chunk, clause.end_in_chunk
            start2, end2 = existing.start_in_chunk, existing.end_in_chunk
            
            overlap_start = max(start1, start2)
            overlap_end = min(end1, end2)
            
            if overlap_start < overlap_end:
                overlap_len = overlap_end - overlap_start
                span_len = max(end1 - start1, 1)
                overlap_ratio = overlap_len / span_len
                
                if overlap_ratio >= overlap_threshold:
                    is_duplicate = True
                    break
        
        if not is_duplicate:
            kept.append(clause)
    
    return kept


def filter_spans(
    clauses: List[DetectedClause],
    min_confidence: float = 0.3,
    min_length: int = 10,
    max_length: int = 2000,
    deduplicate: bool = True,
) -> List[DetectedClause]:
    """Full span filtering pipeline.
    
    1. Apply validity filters (confidence, length)
    2. Compute quality scores
    3. Deduplicate overlapping spans
    4. Sort by quality
    
    Args:
        clauses: Raw detected clauses from Stage 4.
        min_confidence: Minimum confidence threshold.
        min_length: Minimum span character length.
        max_length: Maximum span character length.
        deduplicate: Whether to remove overlapping spans.
        
    Returns:
        Filtered and ranked list of high-quality clauses.
    """
    # Step 1: Validity filtering
    valid = [
        c for c in clauses
        if is_valid_span(c, min_confidence, min_length, max_length)
    ]
    
    logger.info(
        f"Span filter: {len(clauses)} → {len(valid)} "
        f"(removed {len(clauses) - len(valid)} invalid spans)"
    )
    
    # Step 2: Deduplicate
    if deduplicate:
        # Group by chunk, deduplicate within each chunk
        chunk_groups = {}
        for c in valid:
            chunk_groups.setdefault(c.chunk_id, []).append(c)
        
        deduped = []
        for chunk_id, group in chunk_groups.items():
            deduped.extend(deduplicate_spans(group))
        
        logger.info(
            f"Deduplication: {len(valid)} → {len(deduped)} "
            f"(removed {len(valid) - len(deduped)} duplicates)"
        )
        valid = deduped
    
    # Step 3: Sort by quality score
    valid.sort(key=lambda c: compute_quality_score(c), reverse=True)
    
    return valid
