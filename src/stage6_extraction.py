"""
Stage 6 — Information Extraction (Core Engine)
===============================================
The most important stage.

Converts unstructured span text → structured fields using a HYBRID approach:
  - Rules (regex + keyword dictionaries) for structured parsing  ← runs FIRST
  - ML (spaCy NER) for entity recognition                       ← fills gaps

WHY HYBRID:
  - Pure ML is unreliable for structured parsing
  - Pure rules are too rigid
  - Rules win when they match; spaCy fills in what rules miss

spaCy integration points:
  - Value:    MONEY / PERCENT / CARDINAL entities → fallback when regex misses
  - Deadline: DATE / TIME entities → fallback for freeform dates ("by Q3 2025")
  - Metric:   Noun-chunk heuristic → last-resort when no pattern matches

Input:  "debt-to-equity ratio below 1.5, tested quarterly"
Output: {metric_name, operator, threshold_value, deadline, consequence}
"""

import logging
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from matplotlib import text

from src.stage4_qa_detection import DetectedClause

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# spaCy — lazy singleton (model loaded once, reused everywhere)
# ═══════════════════════════════════════════════════════════════════════════════

_nlp = None  # module-level singleton


def get_nlp():
    """Return the spaCy model, loading it on first call.

    Falls back gracefully if spaCy / the model is not installed so the rest
    of the pipeline keeps working without ML support.
    """
    global _nlp
    if _nlp is not None:
        return _nlp

    try:
        import spacy
        # en_core_web_sm is fast and sufficient for NER on contract text.
        # Upgrade to en_core_web_md/lg for better recall if time allows.
        _nlp = spacy.load("en_core_web_sm")
        logger.info("spaCy model loaded: en_core_web_sm")
    except OSError:
        logger.warning(
            "spaCy model 'en_core_web_sm' not found. "
            "Run: python -m spacy download en_core_web_sm\n"
            "Falling back to rules-only extraction."
        )
        _nlp = None
    except ImportError:
        logger.warning(
            "spaCy not installed. Falling back to rules-only extraction. "
            "Install with: pip install spacy"
        )
        _nlp = None

    return _nlp


def _spacy_entities(text: str) -> Dict[str, List[str]]:
    """Run spaCy NER on text and return entities grouped by label.

    Returns an empty dict if spaCy is unavailable.
    """
    nlp = get_nlp()
    if nlp is None:
        return {}

    doc = nlp(text)
    result: Dict[str, List[str]] = {}
    for ent in doc.ents:
        result.setdefault(ent.label_, []).append(ent.text.strip())
    return result


def _spacy_noun_chunks(text: str) -> List[str]:
    """Return noun chunks from spaCy parse (used for metric fallback)."""
    nlp = get_nlp()
    if nlp is None:
        return []
    doc = nlp(text)
    return [chunk.text.strip() for chunk in doc.noun_chunks]


# ═══════════════════════════════════════════════════════════════════════════════
# DATA CLASS
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ExtractedObligation:
    """A structured obligation extracted from a clause span."""
    metric_name: Optional[str] = None
    operator: Optional[str] = None
    threshold_value: Optional[float] = None
    threshold_raw: Optional[str] = None  # original text of the value
    deadline: Optional[str] = None
    consequence: Optional[str] = None
    source_text: str = ""
    confidence: float = 0.0
    question_type: str = ""
    chunk_id: int = -1
    # Provenance: which layer supplied each field
    _metric_source: str = field(default="", repr=False)
    _value_source: str = field(default="", repr=False)
    _deadline_source: str = field(default="", repr=False)


# ═══════════════════════════════════════════════════════════════════════════════
# METRIC DETECTION  (rules → spaCy noun-chunk fallback)
# ═══════════════════════════════════════════════════════════════════════════════

METRIC_PATTERNS = {
    "debt_to_equity_ratio": [
        r"debt[\s\-]*to[\s\-]*equity\s+ratio",
        r"debt[/\\]equity\s+ratio",
        r"D/E\s+ratio",
    ],
    "current_ratio": [r"current\s+ratio"],
    "debt_service_coverage_ratio": [
        r"debt\s+service\s+coverage\s+ratio",
        r"DSCR",
    ],
    "interest_coverage_ratio": [
        r"interest\s+coverage\s+ratio",
        r"ICR",
        r"times\s+interest\s+earned",
    ],
    "leverage_ratio": [r"leverage\s+ratio", r"total\s+leverage"],
    "fixed_charge_coverage_ratio": [
        r"fixed\s+charge\s+coverage\s+ratio",
        r"FCCR",
    ],
    "loan_to_value_ratio": [
        r"loan[\s\-]*to[\s\-]*value\s+ratio",
        r"LTV\s+ratio",
        r"LTV",
    ],
    "net_worth": [r"(?:minimum\s+)?(?:tangible\s+)?net\s+worth"],
    "ebitda": [r"EBITDA", r"earnings\s+before\s+interest"],
    "revenue": [
        r"(?:minimum\s+|annual\s+|gross\s+)?revenue",
        r"(?:minimum\s+|annual\s+|gross\s+)?sales",
    ],
    "working_capital": [r"working\s+capital"],
    "capital_expenditure": [r"capital\s+expenditure[s]?", r"capex"],
    "total_debt": [r"total\s+(?:funded\s+)?debt", r"total\s+indebtedness"],
    "cash_reserve": [
        r"cash\s+reserve[s]?",
        r"minimum\s+cash",
        r"cash\s+balance",
    ],
"insurance_coverage": [
    r"commercial\s+general\s+liability\s+insurance",
    r"professional\s+liability\s+insurance",
    r"liability\s+insurance",
    r"insurance\s+coverage",
    r"insurance\s+(?:amount|limit|requirement)",
],
    "purchase_order": [r"purchase\s+order", r"minimum\s+(?:order|purchase)"],
    "unit_commitment": [r"(?:minimum\s+)?(?:number\s+of\s+)?units?"],
}

# Keywords that suggest a noun chunk is a financial metric
_METRIC_CHUNK_KEYWORDS = {
    "ratio", "rate", "coverage", "margin", "debt", "equity", "capital",
    "leverage", "ebitda", "revenue", "income", "worth", "value", "reserve",
    "expenditure", "liquidity", "solvency", "cash", "insurance", "commitment",
}


def _rules_detect_metric(text: str) -> Optional[str]:
    """Pattern-based metric detection."""
    for metric_name, patterns in METRIC_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return metric_name
    return None


def _spacy_detect_metric(text: str) -> Optional[str]:
    """Noun-chunk heuristic with basic filtering to avoid useless chunks."""
    for chunk in _spacy_noun_chunks(text):
        chunk_lower = chunk.lower().strip()
        tokens = set(chunk_lower.split())

        if tokens & _METRIC_CHUNK_KEYWORDS:
            # ❌ Reject useless references like "this ratio", "that ratio"
            if chunk_lower.startswith(("this", "that", "such", "these", "those")):
                continue

            # ❌ Reject very short meaningless chunks
            if len(tokens) <= 1:
                continue

            return chunk_lower.replace(" ", "_")

    return None


def detect_metric(text: str) -> Tuple[Optional[str], str]:
    """Detect financial metric; returns (metric, source) where source ∈ {'rules','spacy',''}."""
    result = _rules_detect_metric(text)
    if result:
        return result, "rules"
    result = _spacy_detect_metric(text)
    if result:
        return result, "spacy"
    return None, ""


# ═══════════════════════════════════════════════════════════════════════════════
# OPERATOR DETECTION  (rules only — spaCy adds no value here)
# ═══════════════════════════════════════════════════════════════════════════════

OPERATOR_MAPPINGS = [
    (r"not\s+(?:to\s+)?exceed", "less_equal"),
    (r"shall\s+not\s+exceed", "less_equal"),
    (r"may\s+not\s+exceed", "less_equal"),
    (r"no\s+(?:more|greater)\s+than", "less_equal"),
    (r"not\s+(?:more|greater)\s+than", "less_equal"),
    (r"at\s+most", "less_equal"),
    (r"up\s+to\s+(?:a\s+maximum\s+of\s+)?", "less_equal"),
    (r"not\s+(?:less|lower|fewer)\s+than", "greater_equal"),
    (r"no\s+(?:less|lower|fewer)\s+than", "greater_equal"),
    (r"at\s+least", "greater_equal"),
    (r"a\s+minimum\s+of", "greater_equal"),
    (r"minimum\s+of", "greater_equal"),
    (r"(?:equal\s+to\s+or\s+)?(?:greater|more|higher)\s+than", "greater_than"),
    (r"(?:equal\s+to\s+or\s+)?(?:less|lower|fewer)\s+than", "less_than"),
    (r"(?:greater|more|higher)\s+than\s+or\s+equal\s+to", "greater_equal"),
    (r"(?:less|lower|fewer)\s+than\s+or\s+equal\s+to", "less_equal"),
    (r"in\s+excess\s+of", "greater_than"),
    (r"exceeds?", "greater_than"),
    (r"(?:below|under|beneath)", "less_than"),
    (r"(?:above|over)", "greater_than"),
    (r"(?:equal|equivalent)\s+to", "equal"),
    (r"<=", "less_equal"),
    (r">=", "greater_equal"),
    (r"<", "less_than"),
    (r">", "greater_than"),
    (r"=", "equal"),
    (r"maintain(?:s|ed|ing)?(?:\s+a)?", "greater_equal"),
]


def detect_operator(text: str) -> Optional[str]:
    text_lower = text.lower().strip()
    for pattern, operator in OPERATOR_MAPPINGS:
        if re.search(pattern, text_lower):
            return operator
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# VALUE EXTRACTION  (rules → spaCy MONEY / PERCENT / CARDINAL fallback)
# ═══════════════════════════════════════════════════════════════════════════════

VALUE_PATTERNS = [
    (r"\$\s*([\d,]+(?:\.\d+)?)\s*(?:million|MM|M)\b",
     lambda m: float(m.group(1).replace(",", "")) * 1_000_000),
    (r"\$\s*([\d,]+(?:\.\d+)?)\s*(?:billion|B)\b",
     lambda m: float(m.group(1).replace(",", "")) * 1_000_000_000),
    (r"\$\s*([\d,]+(?:\.\d+)?)\s*(?:thousand|K)\b",
     lambda m: float(m.group(1).replace(",", "")) * 1_000),
    (r"\$\s*([\d,]+(?:\.\d+)?)",
     lambda m: float(m.group(1).replace(",", ""))),
    (r"([\d,]+(?:\.\d+)?)\s*%",
     lambda m: float(m.group(1).replace(",", "")) / 100),
    (r"([\d,]+(?:\.\d+)?)\s*(?:x|X)(?:\s|,|$)",
     lambda m: float(m.group(1).replace(",", ""))),
    (r"([\d,]+(?:\.\d+)?)\s*(?::\s*1|to\s*1)",
     lambda m: float(m.group(1).replace(",", ""))),
    (r"([\d,]+(?:\.\d+)?)\s*million\b",
     lambda m: float(m.group(1).replace(",", "")) * 1_000_000),
    (r"([\d,]+(?:\.\d+)?)\s*billion\b",
     lambda m: float(m.group(1).replace(",", "")) * 1_000_000_000),
    (r"(?<![.\w])([\d,]+(?:\.\d+)?)(?![.\w])",
     lambda m: float(m.group(1).replace(",", "")) or None),
]


def _rules_extract_value(text: str) -> Tuple[Optional[float], Optional[str]]:
    # Reject deadline-like values (days)
    if re.search(r'\b\d+\s+days?\b', text, re.IGNORECASE):
        return None, None
    if re.search(r'\d+\s+days?\s+(?:written\s+)?notice', text, re.IGNORECASE):
        return None, None
    if re.search(r'within\s+\d+\s+(?:business\s+)?days?', text, re.IGNORECASE):
        return None, None
    for pattern, parser in VALUE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                value = parser(match)
                if value is not None and value > 0:
                    return value, match.group(0).strip()
            except (ValueError, IndexError):
                continue
    return None, None


def _spacy_extract_value(text: str) -> Tuple[Optional[float], Optional[str]]:
    """Use spaCy MONEY / PERCENT / CARDINAL entities to extract a value.

    Tries to parse the entity text to a float; returns the first success.
    """
    entities = _spacy_entities(text)
    for label in ("MONEY", "PERCENT", "CARDINAL"):
        for ent_text in entities.get(label, []):
            # Strip currency symbols and normalise
            cleaned = re.sub(r"[£€$,]", "", ent_text).strip()
            # Handle multiplier suffixes
            multiplier = 1.0
            if re.search(r"\b(million|MM|M)\b", cleaned, re.I):
                multiplier = 1_000_000
                cleaned = re.sub(r"\b(million|MM|M)\b", "", cleaned, flags=re.I).strip()
            elif re.search(r"\bbillion\b", cleaned, re.I):
                multiplier = 1_000_000_000
                cleaned = re.sub(r"\bbillion\b", "", cleaned, flags=re.I).strip()
            # Handle percentage
            is_pct = "%" in cleaned or label == "PERCENT"
            cleaned = cleaned.replace("%", "").strip()
            try:
                value = float(cleaned) * multiplier
                if is_pct:
                    value /= 100
                if value > 0:
                    return value, ent_text
            except ValueError:
                continue
    return None, None


def extract_value(text: str) -> Tuple[Optional[float], Optional[str], str]:
    """Extract numeric threshold; returns (value, raw_text, source)."""
    value, raw = _rules_extract_value(text)
    if value is not None:
        return value, raw, "rules"
    value, raw = _spacy_extract_value(text)
    if value is not None:
        return value, raw, "spacy"
    return None, None, ""


# ═══════════════════════════════════════════════════════════════════════════════
# DEADLINE DETECTION  (rules → spaCy DATE / TIME fallback)
# ═══════════════════════════════════════════════════════════════════════════════

DEADLINE_PATTERNS = [
    (r"\b(quarterly)\b", "quarterly"),
    (r"\b(annually|annual)\b", "annually"),
    (r"\b(monthly)\b", "monthly"),
    (r"\b(semi[\s\-]?annual(?:ly)?)\b", "semi_annually"),
    (r"\b(weekly)\b", "weekly"),
    (r"\b(daily)\b", "daily"),
    (r"\b(bi[\s\-]?annual(?:ly)?)\b", "semi_annually"),
    (r"\bwithin\s+(\d+)\s+(?:business\s+)?days?\b", None),
    (r"\bwithin\s+(\d+)\s+months?\b", None),
    (r"\b(?:each|every)\s+(fiscal\s+(?:year|quarter))\b", None),
    (r"\b(?:each|every)\s+(calendar\s+(?:year|quarter|month))\b", None),
    (r"\b(?:each|per)\s+(contract\s+year)\b", None),
    (r"\b(?:each|per)\s+(product\s+year)\b", None),
    (r"\b(end\s+of\s+(?:each|every)\s+(?:fiscal|calendar)?\s*(?:year|quarter|month))\b", None),
]


def _rules_detect_deadline(text: str) -> Optional[str]:
    text_lower = text.lower().strip()
    for pattern, canonical in DEADLINE_PATTERNS:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            return canonical if canonical else match.group(0).strip().replace("  ", " ")
    return None


def _spacy_detect_deadline(text: str) -> Optional[str]:
    """Return the first DATE or TIME entity as a raw deadline string.

    Used only when rules return None — useful for freeform dates like
    'by the end of Q3 2025' or 'no later than 31 December 2024'.
    """
    entities = _spacy_entities(text)
    for label in ("DATE", "TIME"):
        hits = entities.get(label, [])
        if hits:
            return hits[0]  # return raw entity text; caller can normalise further
    return None


def detect_deadline(text: str) -> Tuple[Optional[str], str]:
    """Detect temporal/deadline info; returns (deadline, source)."""
    result = _rules_detect_deadline(text)
    if result:
        return result, "rules"
    result = _spacy_detect_deadline(text)
    if result:
        return result, "spacy"
    return None, ""


# ═══════════════════════════════════════════════════════════════════════════════
# CONSEQUENCE DETECTION  (rules only)
# ═══════════════════════════════════════════════════════════════════════════════

CONSEQUENCE_PATTERNS = [
    (r"\b(event\s+of\s+default)\b", "default"),
    (r"\b(default)\b", "default"),
    (r"\b(terminat(?:e|ion|ed))\b", "termination"),
    (r"\b(penalty|penalt(?:y|ies))\b", "penalty"),
    (r"\b(acceleration)\b", "acceleration"),
    (r"\b(remediat(?:e|ion))\b", "remediation"),
    (r"\b(cure\s+period)\b", "cure_period"),
    (r"\b(liquidated\s+damages?)\b", "liquidated_damages"),
    (r"\b(breach)\b", "breach"),
    (r"\b(forfeiture|forfeit)\b", "forfeiture"),
    (r"\b(revocation|revoke)\b", "revocation"),
]


def detect_consequence(text: str) -> Optional[str]:
    text_lower = text.lower().strip()
    for pattern, canonical in CONSEQUENCE_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return canonical
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════════

def extract_from_clause(clause: DetectedClause) -> ExtractedObligation:
    """Extract structured obligation fields from a detected clause.

    Strategy per field:
      metric    → rules on span → spaCy noun-chunk on span → rules on chunk → spaCy on chunk
      operator  → rules on span → rules on chunk
      value     → rules on span → spaCy on span → rules on chunk → spaCy on chunk
      deadline  → rules on span → spaCy on span → rules on chunk → spaCy on chunk
      consequence → rules on span → rules on chunk
    """
    span = clause.span_text
    ctx  = clause.chunk_text  # wider context

    # ── Metric ──────────────────────────────────────────────────────────
    metric, metric_src = detect_metric(span)
    if metric is None:
        metric, metric_src = detect_metric(ctx)
        if metric_src:
            metric_src = f"ctx_{metric_src}"  # tag as coming from context

    # ── Operator ─────────────────────────────────────────────────────────
    operator = detect_operator(span) or detect_operator(ctx)

    # ── Value ────────────────────────────────────────────────────────────
    value, raw_value, value_src = extract_value(span)
    if value is None:
        if value is not None:
            if value < 100 and (metric is None or "ratio" not in metric):
                value = None
        value, raw_value, value_src = extract_value(ctx)
        if value_src:
            value_src = f"ctx_{value_src}"

    # ── Deadline ─────────────────────────────────────────────────────────
    deadline, deadline_src = detect_deadline(span)
    if deadline is None:
        deadline, deadline_src = detect_deadline(ctx)
        if deadline_src:
            deadline_src = f"ctx_{deadline_src}"

    # ── Consequence ──────────────────────────────────────────────────────
    consequence = detect_consequence(span) or detect_consequence(ctx)

    return ExtractedObligation(
        metric_name=metric,
        operator=operator,
        threshold_value=value,
        threshold_raw=raw_value,
        deadline=deadline,
        consequence=consequence,
        source_text=span,
        confidence=clause.confidence,
        question_type=clause.question_type,
        chunk_id=clause.chunk_id,
        _metric_source=metric_src,
        _value_source=value_src,
        _deadline_source=deadline_src,
    )


def extract_obligations(clauses: List[DetectedClause]) -> List[ExtractedObligation]:
    """Extract structured obligations from all detected clauses."""
    obligations = [extract_from_clause(c) for c in clauses]

    logger.info(f"Extracted {len(obligations)} obligations from {len(clauses)} clauses")

    with_metric    = sum(1 for o in obligations if o.metric_name)
    with_value     = sum(1 for o in obligations if o.threshold_value is not None)
    with_operator  = sum(1 for o in obligations if o.operator)
    with_deadline  = sum(1 for o in obligations if o.deadline)

    # Provenance breakdown (rules vs spaCy)
    spacy_metrics   = sum(1 for o in obligations if "spacy" in o._metric_source)
    spacy_values    = sum(1 for o in obligations if "spacy" in o._value_source)
    spacy_deadlines = sum(1 for o in obligations if "spacy" in o._deadline_source)

    logger.info(
        f"  metric: {with_metric} | value: {with_value} | "
        f"operator: {with_operator} | deadline: {with_deadline}"
    )
    logger.info(
        f"  spaCy contributed — metric: {spacy_metrics}, "
        f"value: {spacy_values}, deadline: {spacy_deadlines}"
    )

    return obligations
