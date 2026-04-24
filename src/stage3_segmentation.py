"""
Stage 3 — Paragraph Segmentation (CRITICAL)
============================================
Splits full contract text into semantic paragraph-level chunks.

WHY THIS IS CRITICAL:
  Contracts don't express obligations in single sentences:
    "The borrower shall maintain..."
    "...a ratio not exceeding..."
    "...tested quarterly."

  If you split into sentences → you lose meaning.
  We split at PARAGRAPH level to preserve semantic units.

  Also, CUAD contexts are full contracts (avg 54K chars).
  QA models have 512-token windows. We MUST chunk.

Input:  Cleaned text string
Output: List of Chunk objects (text + metadata)
"""

import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class Chunk:
    """A semantic paragraph-level chunk of contract text."""
    text: str
    chunk_id: int
    start_offset: int  # character offset in original text
    end_offset: int    # character offset in original text
    section_header: str = ""  # detected section header, if any
    
    def __len__(self):
        return len(self.text)


# Patterns for section headers in contracts
SECTION_HEADER_PATTERNS = [
    # "ARTICLE I", "ARTICLE 1", "ARTICLE ONE"
    re.compile(r"^\s*(ARTICLE\s+[IVXLCDM\d]+[.]?)\s*", re.IGNORECASE),
    # "Section 1.1", "Section 1", "SECTION 1.1(a)"
    re.compile(r"^\s*(SECTION\s+\d+(?:\.\d+)*(?:\([a-z]\))?[.]?)\s*", re.IGNORECASE),
    # "1.", "1.1", "1.1.1" at start of line
    re.compile(r"^\s*(\d+(?:\.\d+)*[.)]\s)"),
    # "(a)", "(b)", "(i)", "(ii)"
    re.compile(r"^\s*(\([a-z]+\)|\([ivxlcdm]+\))\s", re.IGNORECASE),
    # ALL CAPS headers (e.g., "DEFINITIONS", "REPRESENTATIONS AND WARRANTIES")
    re.compile(r"^\s*([A-Z][A-Z\s]{4,})\s*$"),
]


def detect_section_header(text: str) -> str:
    """Detect if text starts with a section header pattern."""
    first_line = text.split("\n")[0] if text else ""
    for pattern in SECTION_HEADER_PATTERNS:
        match = pattern.match(first_line)
        if match:
            return match.group(1).strip()
    return ""


def split_into_paragraphs(text: str) -> List[str]:
    """Split text on double-newline boundaries (primary split).
    
    This is the natural paragraph boundary in most documents.
    """
    # Split on double newlines
    raw_paragraphs = re.split(r"\n\s*\n", text)
    
    # Filter out empty paragraphs
    paragraphs = [p.strip() for p in raw_paragraphs if p.strip()]
    
    return paragraphs


def split_by_section_headers(text: str) -> List[str]:
    """Split text at section header boundaries.
    
    Used as secondary split when double-newline splitting
    produces chunks that are still too large.
    """
    # Split at lines that look like section headers
    parts = []
    current = []
    
    for line in text.split("\n"):
        is_header = any(p.match(line) for p in SECTION_HEADER_PATTERNS[:3])
        
        if is_header and current:
            parts.append("\n".join(current))
            current = [line]
        else:
            current.append(line)
    
    if current:
        parts.append("\n".join(current))
    
    return [p.strip() for p in parts if p.strip()]


def sliding_window_split(text: str, max_chars: int = 1500, overlap_chars: int = 200) -> List[str]:
    """Split a long text block using sliding window with overlap.
    
    Used when a paragraph exceeds max_chars.
    
    Args:
        text: Text to split.
        max_chars: Maximum characters per chunk (~375 tokens at 4 chars/token).
        overlap_chars: Characters of overlap between windows.
        
    Returns:
        List of text windows.
    """
    if len(text) <= max_chars:
        return [text]
    
    windows = []
    start = 0
    
    while start < len(text):
        end = start + max_chars
        
        # Try to break at a sentence boundary
        if end < len(text):
            # Look for sentence-ending punctuation near the boundary
            search_region = text[max(start, end - 200):end]
            last_period = max(
                search_region.rfind(". "),
                search_region.rfind(".\n"),
                search_region.rfind("; "),
            )
            if last_period > 0:
                end = max(start, end - 200) + last_period + 1
        
        window = text[start:end].strip()
        if window:
            windows.append(window)
        
        start = end - overlap_chars
        if start >= len(text):
            break
    
    return windows


def segment_text(
    text: str,
    max_chunk_chars: int = 1500,
    min_chunk_chars: int = 50,
    overlap_chars: int = 200,
) -> List[Chunk]:
    """Full paragraph segmentation pipeline.
    
    Process:
    1. Primary split on double newlines
    2. If any chunk is too large, try section-header split
    3. If still too large, use sliding window
    4. Discard chunks below minimum length
    
    Args:
        text: Cleaned contract text.
        max_chunk_chars: Maximum characters per chunk.
        min_chunk_chars: Minimum characters per chunk (below = noise).
        overlap_chars: Overlap for sliding window splits.
        
    Returns:
        List of Chunk objects with text and metadata.
    """
    # Step 1: Primary split on double newlines
    paragraphs = split_into_paragraphs(text)
    
    # Step 2: Handle oversized paragraphs
    refined = []
    for para in paragraphs:
        if len(para) <= max_chunk_chars:
            refined.append(para)
        else:
            # Try section-header split first
            sub_parts = split_by_section_headers(para)
            for sub in sub_parts:
                if len(sub) <= max_chunk_chars:
                    refined.append(sub)
                else:
                    # Last resort: sliding window
                    windows = sliding_window_split(sub, max_chunk_chars, overlap_chars)
                    refined.extend(windows)
    
    # Step 3: Filter out tiny chunks (noise)
    filtered = [p for p in refined if len(p) >= min_chunk_chars]
    
    # Step 4: Build Chunk objects with offsets
    chunks = []
    current_offset = 0
    
    for i, para_text in enumerate(filtered):
        # Find the actual offset in the original text
        offset = text.find(para_text, current_offset)
        if offset == -1:
            # Fallback: use approximate offset (can happen with sliding window)
            offset = current_offset
        
        chunk = Chunk(
            text=para_text,
            chunk_id=i,
            start_offset=offset,
            end_offset=offset + len(para_text),
            section_header=detect_section_header(para_text),
        )
        chunks.append(chunk)
        current_offset = offset + 1  # advance past this chunk
    
    return chunks
