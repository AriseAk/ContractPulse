"""
Stage 1 — Input Ingestion
=========================
Converts PDF files or raw text into usable plain text.

Input:  PDF file path OR raw text string
Output: Raw text string
"""

import os
from typing import Optional


def ingest_pdf(pdf_path: str) -> str:
    """Extract text from a PDF file using pdfplumber.
    
    Args:
        pdf_path: Absolute or relative path to a PDF file.
        
    Returns:
        Concatenated text from all pages.
        
    Raises:
        FileNotFoundError: If the PDF path doesn't exist.
        ImportError: If pdfplumber is not installed.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    
    try:
        import pdfplumber
    except ImportError:
        raise ImportError("pdfplumber is required for PDF ingestion. Install with: pip install pdfplumber")
    
    pages_text = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
    
    return "\n\n".join(pages_text)


def ingest_text(raw_text: str) -> str:
    """Pass through raw text (e.g., from CUAD dataset context field).
    
    Args:
        raw_text: Raw contract text string.
        
    Returns:
        The same text (validated as non-empty).
        
    Raises:
        ValueError: If text is empty or whitespace-only.
    """
    if not raw_text or not raw_text.strip():
        raise ValueError("Input text is empty or whitespace-only.")
    return raw_text


def ingest(source: str, source_type: Optional[str] = None) -> str:
    """Unified ingestion entry point.
    
    Auto-detects source type if not specified:
    - If source ends with .pdf → treat as PDF path
    - Otherwise → treat as raw text
    
    Args:
        source: Either a file path to a PDF or raw text.
        source_type: Optional override — 'pdf' or 'text'.
        
    Returns:
        Extracted plain text.
    """
    if source_type == "pdf" or (source_type is None and source.strip().lower().endswith(".pdf")):
        return ingest_pdf(source)
    else:
        return ingest_text(source)
