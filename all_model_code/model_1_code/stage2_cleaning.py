"""
Stage 2 — Text Cleaning
========================
Cleans raw contract text for downstream QA processing.

QA models are sensitive to:
  - broken formatting
  - inconsistent spacing
  - garbage characters

Garbage text = bad answers.

Input:  Raw text string
Output: Cleaned text string
"""

import re
import unicodedata


def remove_non_printable(text: str) -> str:
    """Remove non-printable characters except newlines and tabs."""
    cleaned = []
    for ch in text:
        if ch in ("\n", "\t", "\r"):
            cleaned.append(ch)
        elif unicodedata.category(ch)[0] != "C":  # Not a control character
            cleaned.append(ch)
    return "".join(cleaned)


def normalize_unicode(text: str) -> str:
    """Normalize unicode characters to ASCII-friendly equivalents."""
    replacements = {
        "\u2018": "'",   # left single quote
        "\u2019": "'",   # right single quote
        "\u201c": '"',   # left double quote
        "\u201d": '"',   # right double quote
        "\u2013": "-",   # en dash
        "\u2014": "-",   # em dash
        "\u2026": "...", # ellipsis
        "\u00a0": " ",   # non-breaking space
        "\u2264": "<=",  # ≤
        "\u2265": ">=",  # ≥
        "\u00b7": ".",   # middle dot
        "\u2022": "-",   # bullet
        "\u00bd": "0.5", # ½
        "\u00bc": "0.25",# ¼
        "\u00be": "0.75",# ¾
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def normalize_whitespace(text: str) -> str:
    """Normalize whitespace: collapse multiple spaces, preserve paragraph breaks."""
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    
    # Collapse multiple spaces (but not newlines) within lines
    text = re.sub(r"[^\S\n]+", " ", text)
    
    # Collapse 3+ newlines into 2 (preserve paragraph breaks)
    text = re.sub(r"\n{3,}", "\n\n", text)
    
    return text.strip()


def merge_broken_lines(text: str) -> str:
    """Merge lines that were broken mid-sentence.
    
    Contracts often have hard line breaks in the middle of sentences
    due to PDF formatting. We merge them back.
    
    A line is considered "broken" if:
    - It doesn't end with sentence-ending punctuation
    - The next line starts with a lowercase letter
    """
    lines = text.split("\n")
    merged = []
    i = 0
    
    while i < len(lines):
        line = lines[i].rstrip()
        
        # Look ahead: if next line starts lowercase and current doesn't end with
        # paragraph-ending patterns, merge them
        while (
            i + 1 < len(lines)
            and line  # current line is not empty
            and lines[i + 1].strip()  # next line is not empty
            and not re.search(r"[.!?:;]\s*$", line)  # current doesn't end sentence
            and not re.match(r"^\s*$", lines[i + 1])  # next is not blank
            and re.match(r"^\s*[a-z]", lines[i + 1])  # next starts lowercase
            and not re.match(r"^\s*\d+[.)]\s", lines[i + 1])  # next isn't a numbered item
            and not re.match(r"^\s*[(\[•\-]", lines[i + 1])  # next isn't a list item
        ):
            i += 1
            line = line + " " + lines[i].strip()
        
        merged.append(line)
        i += 1
    
    return "\n".join(merged)


def remove_headers_footers(text: str) -> str:
    """Remove common header/footer patterns from contract text."""
    # Page numbers: "Page X of Y", "- X -", etc.
    text = re.sub(r"(?m)^\s*-?\s*\d+\s*-?\s*$", "", text)
    text = re.sub(r"(?mi)^\s*page\s+\d+\s*(of\s+\d+)?\s*$", "", text)
    
    # Common footer patterns
    text = re.sub(r"(?mi)^\s*confidential\s*$", "", text)
    text = re.sub(r"(?mi)^\s*exhibit\s+\d+\s*$", "", text)
    
    return text


def clean_text(text: str) -> str:
    """Full text cleaning pipeline.
    
    Applies all cleaning steps in the correct order:
    1. Remove non-printable characters
    2. Normalize unicode symbols
    3. Remove headers/footers
    4. Merge broken lines
    5. Normalize whitespace
    
    Args:
        text: Raw contract text.
        
    Returns:
        Cleaned text ready for segmentation.
    """
    text = remove_non_printable(text)
    text = normalize_unicode(text)
    text = remove_headers_footers(text)
    text = merge_broken_lines(text)
    text = normalize_whitespace(text)
    
    return text
