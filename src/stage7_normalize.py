"""
Stage 7 — Normalization & Validation
=====================================
Raw extraction is messy. This stage:

1. NORMALIZES: Standardizes all field values for consistent Model 2 input
   - "below" → "less_than"
   - "Debt to Equity Ratio" → "debt_to_equity_ratio"
   - "1.5x" → 1.5

2. VALIDATES: Prevents garbage from reaching Model 2
   - Does value exist?
   - Is operator valid?
   - Is metric recognized?

3. OUTPUTS: Final structured JSON per obligation

Input:  List of ExtractedObligation from Stage 6
Output: List of validated, normalized JSON-serializable dicts
"""

import logging
from dataclasses import asdict
from typing import Any, Dict, List, Optional

from src.stage6_extraction import ExtractedObligation

logger = logging.getLogger(__name__)


# Valid operators that Model 2 can consume
VALID_OPERATORS = {
    "less_than",
    "less_equal",
    "greater_than",
    "greater_equal",
    "equal",
}

# Known metrics that Model 2 understands
KNOWN_METRICS = {
    "debt_to_equity_ratio",
    "current_ratio",
    "debt_service_coverage_ratio",
    "interest_coverage_ratio",
    "leverage_ratio",
    "fixed_charge_coverage_ratio",
    "loan_to_value_ratio",
    "net_worth",
    "ebitda",
    "revenue",
    "working_capital",
    "capital_expenditure",
    "total_debt",
    "cash_reserve",
    "insurance_coverage",
    "purchase_order",
    "unit_commitment",
}


def normalize_metric(metric: Optional[str]) -> Optional[str]:
    """Normalize metric name to snake_case canonical form.
    
    Args:
        metric: Raw metric name from extraction.
        
    Returns:
        Normalized metric name or None.
    """
    if metric is None:
        return None
    
    # Already in canonical form from our extraction patterns
    normalized = metric.lower().strip()
    normalized = normalized.replace(" ", "_").replace("-", "_")
    
    # Remove multiple underscores
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    
    return normalized


def normalize_operator(operator: Optional[str]) -> Optional[str]:
    """Normalize operator to canonical form.
    
    Args:
        operator: Raw operator from extraction.
        
    Returns:
        Normalized operator or None.
    """
    if operator is None:
        return None
    
    normalized = operator.lower().strip()
    
    # Map any remaining non-canonical forms
    aliases = {
        "lt": "less_than",
        "lte": "less_equal",
        "gt": "greater_than",
        "gte": "greater_equal",
        "eq": "equal",
        "<": "less_than",
        "<=": "less_equal",
        ">": "greater_than",
        ">=": "greater_equal",
        "=": "equal",
    }
    
    return aliases.get(normalized, normalized)


def normalize_deadline(deadline: Optional[str]) -> Optional[str]:
    """Normalize deadline to canonical form.
    
    Args:
        deadline: Raw deadline from extraction.
        
    Returns:
        Normalized deadline or None.
    """
    if deadline is None:
        return None
    
    normalized = deadline.lower().strip()
    
    aliases = {
        "annual": "annually",
        "quarter": "quarterly",
        "month": "monthly",
        "semi-annually": "semi_annually",
        "semi annually": "semi_annually",
        "semiannually": "semi_annually",
        "biannually": "semi_annually",
        "bi-annually": "semi_annually",
    }
    
    return aliases.get(normalized, normalized)


def normalize_obligation(obligation: ExtractedObligation) -> ExtractedObligation:
    """Apply all normalizations to an obligation.
    
    Args:
        obligation: Raw extracted obligation.
        
    Returns:
        New ExtractedObligation with normalized fields.
    """
    return ExtractedObligation(
        metric_name=normalize_metric(obligation.metric_name),
        operator=normalize_operator(obligation.operator),
        threshold_value=obligation.threshold_value,
        threshold_raw=obligation.threshold_raw,
        deadline=normalize_deadline(obligation.deadline),
        consequence=obligation.consequence,
        source_text=obligation.source_text,
        confidence=obligation.confidence,
        question_type=obligation.question_type,
        chunk_id=obligation.chunk_id,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

def validate_obligation(
    obligation: ExtractedObligation,
    require_metric: bool = False,
    require_value: bool = False,
    require_operator: bool = False,
    min_fields: int = 2,
) -> bool:
    """Validate that an obligation has sufficient information.
    
    An obligation is valid if it has enough structured fields
    to be useful for Model 2.
    
    Args:
        obligation: Normalized obligation to validate.
        require_metric: If True, metric_name must be present.
        require_value: If True, threshold_value must be present.
        require_operator: If True, operator must be present.
        min_fields: Minimum number of non-None fields required
                    (among metric, operator, value, deadline).
        
    Returns:
        True if obligation passes validation.
    """
    # Hard requirements
    if require_metric and not obligation.metric_name:
        return False
    
    if require_value and obligation.threshold_value is None:
        return False
    
    if require_operator and not obligation.operator:
        return False
    
    # Check operator validity
    if obligation.operator and obligation.operator not in VALID_OPERATORS:
        logger.warning(f"Invalid operator: {obligation.operator}")
        return False
    
    # Count populated fields
    field_count = sum([
        obligation.metric_name is not None,
        obligation.operator is not None,
        obligation.threshold_value is not None,
        obligation.deadline is not None,
    ])
    
    if field_count < min_fields:
        return False
    
    # Sanity check on threshold value
    if obligation.threshold_value is not None:
        if obligation.threshold_value < 0:
            return False
        if obligation.threshold_value > 1e15:  # unreasonably large
            return False
    
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUT FORMATTING
# ═══════════════════════════════════════════════════════════════════════════════

def obligation_to_dict(obligation: ExtractedObligation) -> Dict[str, Any]:
    """Convert an obligation to a JSON-serializable dictionary.
    
    This is the final output format for Model 2.
    
    Args:
        obligation: A normalized, validated obligation.
        
    Returns:
        Dict ready for JSON serialization.
    """
    return {
        "metric_name": obligation.metric_name,
        "operator": obligation.operator,
        "threshold_value": obligation.threshold_value,
        "deadline": obligation.deadline,
        "consequence": obligation.consequence,
        "confidence_score": round(obligation.confidence, 4),
        "source_text": obligation.source_text,
        "question_type": obligation.question_type,
        "chunk_id": obligation.chunk_id,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN NORMALIZE + VALIDATE PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def normalize_and_validate(
    obligations: List[ExtractedObligation],
    require_metric: bool = False,
    require_value: bool = False,
    min_fields: int = 2,
) -> List[Dict[str, Any]]:
    """Full normalization and validation pipeline.
    
    1. Normalize all fields
    2. Validate each obligation
    3. Convert to JSON-serializable dicts
    
    Args:
        obligations: Raw obligations from Stage 6.
        require_metric: Whether metric_name is required.
        require_value: Whether threshold_value is required.
        min_fields: Minimum structured fields required.
        
    Returns:
        List of validated, normalized obligation dicts.
    """
    results = []
    rejected = 0
    
    for obligation in obligations:
        # Step 1: Normalize
        normalized = normalize_obligation(obligation)
        
        # Step 2: Validate
        if not validate_obligation(
            normalized,
            require_metric=require_metric,
            require_value=require_value,
            min_fields=min_fields,
        ):
            rejected += 1
            continue
        
        # Step 3: Convert to dict
        result = obligation_to_dict(normalized)
        results.append(result)
    
    logger.info(
        f"Normalize & Validate: {len(obligations)} → {len(results)} "
        f"(rejected {rejected})"
    )
    
    return results
