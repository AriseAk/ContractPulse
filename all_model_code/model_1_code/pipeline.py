"""
Pipeline Orchestrator
=====================
Ties all stages together into a single callable pipeline:

  ingest → clean → segment → qa_detect → filter → extract → normalize → validate → JSON

Accepts single contract or batch processing.
Logs intermediate outputs at each stage for debugging.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional, Union

from all_model_code.model_1_code.stage1_ingestion import ingest
from all_model_code.model_1_code.stage2_cleaning import clean_text
from all_model_code.model_1_code.stage3_segmentation import Chunk, segment_text
from all_model_code.model_1_code.stage4_qa_detection import QAClauseDetector, OBLIGATION_QUESTIONS
from all_model_code.model_1_code.stage5_span_filter import filter_spans
from all_model_code.model_1_code.stage6_extraction import extract_obligations
from all_model_code.model_1_code.stage7_normalize import normalize_and_validate
from all_model_code.model_1_code.utils import get_device

logger = logging.getLogger(__name__)


# Default configuration
DEFAULT_CONFIG = {
    # QA Model
    "model_name": "deepset/roberta-base-squad2",
    "device": "auto",  # auto-detect GPU (RTX 4050 6GB VRAM)
    
    # Segmentation
    "max_chunk_chars": 1500,
    "min_chunk_chars": 50,
    "overlap_chars": 200,
    
    # QA Detection
    "qa_confidence_threshold": 0.01,
    "max_answer_length": 200,
    
    # Span Filtering
    "filter_min_confidence": 0.05,
    "filter_min_length": 10,
    "filter_max_length": 2000,
    "filter_deduplicate": True,
    
    # Normalization & Validation
    "require_metric": False,
    "require_value": False,
    "min_fields": 2,
}


class ObligationPipeline:
    """End-to-end contract obligation extraction pipeline.
    
    Usage:
        pipeline = ObligationPipeline()
        results = pipeline.process("path/to/contract.pdf")
        # or
        results = pipeline.process(raw_text, source_type="text")
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize pipeline with configuration.
        
        Args:
            config: Optional config dict. Missing keys use DEFAULT_CONFIG.
        """
        self.config = {**DEFAULT_CONFIG, **(config or {})}
        self.detector = None  # Lazy-loaded
        
        # Stage-level intermediate results (for debugging)
        self._debug = {}
    
    def _get_detector(self) -> QAClauseDetector:
        """Get or create the QA detector (lazy loading)."""
        if self.detector is None:
            self.detector = QAClauseDetector(
                model_name=self.config["model_name"],
                device=self.config["device"],
                confidence_threshold=self.config["qa_confidence_threshold"],
                max_answer_length=self.config["max_answer_length"],
            )
        return self.detector
    
    def process(
        self,
        source: str,
        source_type: Optional[str] = None,
        contract_id: Optional[str] = None,
        questions: Optional[dict] = None,
        debug: bool = False,
    ) -> List[Dict[str, Any]]:
        """Run the full pipeline on a single contract.
        
        Args:
            source: PDF path or raw text.
            source_type: 'pdf' or 'text' (auto-detected if None).
            contract_id: Optional identifier for the contract.
            questions: Optional custom questions dict.
            debug: If True, store intermediate results in self._debug.
            
        Returns:
            List of structured obligation dicts ready for Model 2.
        """
        self._debug = {}
        
        # ─── Stage 1: Ingestion ──────────────────────────────────────────
        logger.info("Stage 1: Ingestion")
        raw_text = ingest(source, source_type)
        if debug:
            self._debug["raw_text_length"] = len(raw_text)
        
        # ─── Stage 2: Text Cleaning ──────────────────────────────────────
        logger.info("Stage 2: Text Cleaning")
        cleaned = clean_text(raw_text)
        if debug:
            self._debug["cleaned_text_length"] = len(cleaned)
        
        # ─── Stage 3: Paragraph Segmentation ─────────────────────────────
        logger.info("Stage 3: Paragraph Segmentation")
        chunks = segment_text(
            cleaned,
            max_chunk_chars=self.config["max_chunk_chars"],
            min_chunk_chars=self.config["min_chunk_chars"],
            overlap_chars=self.config["overlap_chars"],
        )
        logger.info(f"  → {len(chunks)} chunks")
        if debug:
            self._debug["num_chunks"] = len(chunks)
            self._debug["chunk_lengths"] = [len(c) for c in chunks]
        
        # ─── Stage 4: QA-Based Clause Detection ──────────────────────────
        logger.info("Stage 4: QA-Based Clause Detection")
        detector = self._get_detector()
        detections = detector.detect_in_chunks(
            chunks,
            questions=questions or OBLIGATION_QUESTIONS,
            show_progress=True,
        )
        logger.info(f"  → {len(detections)} raw detections")
        if debug:
            self._debug["num_raw_detections"] = len(detections)
        
        # ─── Stage 5: Span Filtering ─────────────────────────────────────
        logger.info("Stage 5: Span Filtering")
        filtered = filter_spans(
            detections,
            min_confidence=self.config["filter_min_confidence"],
            min_length=self.config["filter_min_length"],
            max_length=self.config["filter_max_length"],
            deduplicate=self.config["filter_deduplicate"],
        )
        logger.info(f"  → {len(filtered)} filtered spans")
        if debug:
            self._debug["num_filtered"] = len(filtered)
        
        # ─── Stage 6: Information Extraction ─────────────────────────────
        logger.info("Stage 6: Information Extraction")
        obligations = extract_obligations(filtered)
        if debug:
            self._debug["num_extracted"] = len(obligations)
        
        # ─── Stage 7: Normalization & Validation ─────────────────────────
        logger.info("Stage 7: Normalization & Validation")
        results = normalize_and_validate(
            obligations,
            require_metric=self.config["require_metric"],
            require_value=self.config["require_value"],
            min_fields=self.config["min_fields"],
        )
        logger.info(f"  → {len(results)} validated obligations")
        
        # Add contract_id to all results
        if contract_id:
            for r in results:
                r["contract_id"] = contract_id
        
        if debug:
            self._debug["num_final"] = len(results)
        
        return results
    
    def process_batch(
        self,
        sources: List[Dict[str, str]],
        debug: bool = False,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Process multiple contracts.
        
        Args:
            sources: List of dicts with keys 'source', 'source_type', 'contract_id'.
            debug: If True, store per-contract debug info.
            
        Returns:
            Dict mapping contract_id → list of obligation dicts.
        """
        all_results = {}
        
        for i, src_info in enumerate(sources):
            cid = src_info.get("contract_id", f"contract_{i}")
            logger.info(f"\n{'='*60}")
            logger.info(f"Processing contract {i+1}/{len(sources)}: {cid}")
            logger.info(f"{'='*60}")
            
            results = self.process(
                source=src_info["source"],
                source_type=src_info.get("source_type"),
                contract_id=cid,
                debug=debug,
            )
            all_results[cid] = results
        
        # Summary
        total = sum(len(v) for v in all_results.values())
        logger.info(f"\nBatch complete: {total} obligations from {len(sources)} contracts")
        
        return all_results
    
    def get_debug_info(self) -> Dict[str, Any]:
        """Get intermediate results from the last process() call."""
        return self._debug


def save_results(results: Union[List, Dict], output_path: str):
    """Save pipeline results to a JSON file.
    
    Args:
        results: Obligation dicts from process() or process_batch().
        output_path: Path to output JSON file.
    """
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    logger.info(f"Results saved to {output_path}")
