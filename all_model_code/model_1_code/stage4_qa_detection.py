"""
Stage 4 — QA-Based Clause Detection
====================================
The CUAD-powered heart of the pipeline.

HOW IT WORKS:
  Instead of asking "Is this paragraph relevant?"
  We ask: "What part of this paragraph contains a financial obligation?"

  The QA model LOCALIZES the important text, avoiding full-paragraph noise
  and eliminating the need for fake negatives.

  Input:  question (fixed) + paragraph chunk (variable)
  Output: List of DetectedClause(span_text, confidence, question_type, chunk_id)

DECISION LOGIC:
  A clause is valid if:
    - answer is non-empty (not CLS / no-answer)
    - confidence > threshold

NOTE: transformers v5+ removed the "question-answering" pipeline task.
      We use direct model inference with AutoModelForQuestionAnswering.

Memory Safety:
  - torch and transformers are imported lazily (only when model is loaded)
  - Intermediate tensors are deleted after use
  - GC is triggered after batch processing
"""

import gc
import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

from all_model_code.model_1_code.stage3_segmentation import Chunk
from all_model_code.model_1_code.utils import get_device

logger = logging.getLogger(__name__)


@dataclass
class DetectedClause:
    """A clause detected by the QA model."""
    span_text: str          # The extracted answer span
    confidence: float       # Model confidence score (0-1)
    question_type: str      # Which question triggered this detection
    chunk_id: int           # Which chunk this came from
    chunk_text: str         # The full chunk text (for context)
    start_in_chunk: int     # Character offset of span within chunk
    end_in_chunk: int       # Character offset of span end within chunk


# --- Financial obligation questions ---
# These are the targeted questions we ask for each paragraph.
# They are designed to extract financial obligations, commitments, and constraints.

OBLIGATION_QUESTIONS = {
    "financial_limits": (
        'What clause specifies financial limits or obligations?'
    ),
    "minimum_commitment": (
        'Highlight the parts (if any) of this contract related to '
        '"Minimum Commitment" that should be reviewed by a lawyer. '
        'Details: Is there a minimum order size or minimum amount or '
        'frequency of purchase required?'
    ),
    "price_restrictions": (
        'Highlight the parts (if any) of this contract related to '
        '"Price Restrictions" that should be reviewed by a lawyer. '
        'Details: Is there a restriction on the ability of a party '
        'to raise or lower prices of technology, goods, or services?'
    ),
    "revenue_sharing": (
        'Highlight the parts (if any) of this contract related to '
        '"Revenue/Profit Sharing" that should be reviewed by a lawyer. '
        'Details: Is one party required to share revenue or profit '
        'with the counterparty for any technology, goods, or services?'
    ),
    "cap_on_liability": (
        'Highlight the parts (if any) of this contract related to '
        '"Cap On Liability" that should be reviewed by a lawyer. '
        'Details: Does the contract include a cap on liability upon '
        'the breach of a party\'s obligation?'
    ),
    "liquidated_damages": (
        'Highlight the parts (if any) of this contract related to '
        '"Liquidated Damages" that should be reviewed by a lawyer. '
        'Details: Does the contract contain a clause on liquidated damages?'
    ),
    "volume_restriction": (
        'Highlight the parts (if any) of this contract related to '
        '"Volume Restriction" that should be reviewed by a lawyer. '
        'Details: Is there a fee increase or consent requirement if '
        'one party\'s use of the product/services exceeds certain threshold?'
    ),
    "insurance": (
        'Highlight the parts (if any) of this contract related to '
        '"Insurance" that should be reviewed by a lawyer. '
        'Details: Is there a requirement for insurance that must be maintained?'
    ),
}


class QAClauseDetector:
    """Uses a QA model to detect obligation clauses in contract chunks.
    
    Loads a pre-trained or fine-tuned QA model and runs it against
    each chunk with targeted questions.
    
    Uses direct model inference (not HF pipeline) for compatibility
    with transformers v5+.
    """
    
    def __init__(
        self,
        model_name: str = "deepset/roberta-base-squad2",
        device: str = "auto",
        confidence_threshold: float = 0.01,
        max_answer_length: int = 200,
    ):
        """Initialize the QA detector.
        
        Args:
            model_name: HuggingFace model name or path to fine-tuned checkpoint.
            device: 'auto' (detect GPU), 'cuda', or 'cpu'.
            confidence_threshold: Minimum confidence to consider an answer valid.
            max_answer_length: Maximum answer span length in tokens.
        """
        self.model_name = model_name
        self.device = get_device(device)
        self.confidence_threshold = confidence_threshold
        self.max_answer_length = max_answer_length
        self.model = None
        self.tokenizer = None
    
    def load_model(self):
        """Load model and tokenizer (lazy loading)."""
        if self.model is not None:
            return
        
        # Lazy import to avoid loading torch/transformers into memory at import time
        import torch
        from transformers import AutoModelForQuestionAnswering, AutoTokenizer
        
        self._torch = torch  # store reference for use in _predict
        
        logger.info(f"Loading QA model: {self.model_name} on {self.device}")
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForQuestionAnswering.from_pretrained(self.model_name)
        self.model.to(self.device)
        self.model.eval()
        
        # Use half-precision on GPU to save VRAM (~250MB vs ~500MB)
        if self.device == "cuda":
            self.model.half()
            logger.info("Using FP16 on GPU for memory efficiency.")
        
        logger.info("QA model loaded successfully.")
    
    def _predict(
        self,
        question: str,
        context: str,
    ) -> Tuple[str, float, int, int]:
        """Run QA inference on a single question-context pair.
        
        Unlike strict SQuAD 2.0 evaluation, we do NOT gate on no-answer score.
        The base SQuAD2 model (without CUAD fine-tuning) is too conservative
        and will reject valid contract clauses. Instead, we always return the
        best answer span and compute confidence from softmax probabilities.
        Downstream Stage 5 (span filtering) handles quality control.
        
        Returns:
            Tuple of (answer_text, confidence, char_start, char_end)
        """
        # Tokenize
        inputs = self.tokenizer(
            question,
            context,
            max_length=512,
            truncation=True,
            return_tensors="pt",
            return_offsets_mapping=True,
        )
        
        offset_mapping = inputs.pop("offset_mapping")[0]  # (seq_len, 2)
        
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        torch = self._torch  # local reference for speed
        
        # Inference
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        start_logits = outputs.start_logits[0]  # (seq_len,)
        end_logits = outputs.end_logits[0]       # (seq_len,)
        
        # Find the context token range (skip question tokens)
        # For RoBERTa: [CLS] question [SEP][SEP] context [SEP]
        input_ids = inputs["input_ids"][0]
        sep_positions = (input_ids == self.tokenizer.sep_token_id).nonzero(as_tuple=True)[0]
        
        if len(sep_positions) >= 2:
            context_start_token = sep_positions[1].item() + 1  # after second SEP
        else:
            context_start_token = sep_positions[0].item() + 1  # after first SEP
        
        context_end_token = len(input_ids) - 1  # before last SEP/PAD
        
        # Mask question tokens (set to -inf so they can't be selected)
        start_logits_masked = start_logits.clone()
        end_logits_masked = end_logits.clone()
        start_logits_masked[:context_start_token] = -float("inf")
        end_logits_masked[:context_start_token] = -float("inf")
        
        # Find best valid span in context
        # Only consider spans where start <= end and length <= max_answer_length
        best_score = -float("inf")
        best_start = 0
        best_end = 0
        
        # Get top-k start and end positions for efficiency
        k = min(20, context_end_token - context_start_token + 1)
        if k <= 0:
            return "", 0.0, 0, 0
        
        top_starts = torch.topk(start_logits_masked[context_start_token:context_end_token+1], k=k)
        top_ends = torch.topk(end_logits_masked[context_start_token:context_end_token+1], k=k)
        
        for si in range(k):
            for ei in range(k):
                s_idx = top_starts.indices[si].item() + context_start_token
                e_idx = top_ends.indices[ei].item() + context_start_token
                
                if e_idx < s_idx:
                    continue
                if e_idx - s_idx + 1 > self.max_answer_length:
                    continue
                
                score = start_logits[s_idx].item() + end_logits[e_idx].item()
                if score > best_score:
                    best_score = score
                    best_start = s_idx
                    best_end = e_idx
        
        if best_start == 0 and best_end == 0:
            return "", 0.0, 0, 0
        
        # Compute confidence from softmax probabilities of the selected positions
        # This gives a 0-1 score based on how peaked the probability is
        start_probs = torch.softmax(start_logits_masked, dim=-1)
        end_probs = torch.softmax(end_logits_masked, dim=-1)
        confidence = (start_probs[best_start].item() * end_probs[best_end].item()) ** 0.5
        
        # Map token positions back to character positions
        char_start = offset_mapping[best_start][0].item()
        char_end = offset_mapping[best_end][1].item()
        
        answer_text = context[char_start:char_end].strip()
        
        if not answer_text:
            return "", 0.0, 0, 0
        
        return answer_text, confidence, char_start, char_end
    
    def detect_single(
        self,
        question: str,
        context: str,
        question_type: str,
        chunk_id: int,
    ) -> Optional[DetectedClause]:
        """Run QA on a single question-context pair.
        
        Args:
            question: The question to ask.
            context: The paragraph text to search in.
            question_type: Category label for this question.
            chunk_id: ID of the source chunk.
            
        Returns:
            DetectedClause if answer is valid, None otherwise.
        """
        self.load_model()
        
        try:
            answer_text, score, start, end = self._predict(question, context)
        except Exception as e:
            logger.warning(f"QA inference failed for chunk {chunk_id}: {e}")
            return None
        
        # Decision logic: valid if non-empty and above threshold
        if not answer_text or score < self.confidence_threshold:
            return None
        
        return DetectedClause(
            span_text=answer_text,
            confidence=score,
            question_type=question_type,
            chunk_id=chunk_id,
            chunk_text=context,
            start_in_chunk=start,
            end_in_chunk=end,
        )
    
    def detect_in_chunk(
        self,
        chunk: Chunk,
        questions: Optional[dict] = None,
    ) -> List[DetectedClause]:
        """Run all obligation questions against a single chunk.
        
        Args:
            chunk: A paragraph chunk to analyze.
            questions: Dict of {question_type: question_text}.
                       Defaults to OBLIGATION_QUESTIONS.
                       
        Returns:
            List of detected clauses (may be empty).
        """
        if questions is None:
            questions = OBLIGATION_QUESTIONS
        
        detections = []
        for q_type, q_text in questions.items():
            clause = self.detect_single(
                question=q_text,
                context=chunk.text,
                question_type=q_type,
                chunk_id=chunk.chunk_id,
            )
            if clause is not None:
                detections.append(clause)
        
        return detections
    
    def detect_in_chunks(
        self,
        chunks: List[Chunk],
        questions: Optional[dict] = None,
        show_progress: bool = True,
    ) -> List[DetectedClause]:
        """Run clause detection across all chunks.
        
        Args:
            chunks: List of paragraph chunks.
            questions: Optional custom questions dict.
            show_progress: Whether to show tqdm progress bar.
            
        Returns:
            All detected clauses across all chunks.
        """
        self.load_model()
        
        all_detections = []
        
        iterator = chunks
        if show_progress:
            try:
                from tqdm import tqdm
                iterator = tqdm(chunks, desc="QA Detection", unit="chunk")
            except ImportError:
                pass
        
        for chunk in iterator:
            detections = self.detect_in_chunk(chunk, questions)
            all_detections.extend(detections)
        
        # Clean up GPU/CPU tensor caches after batch processing
        gc.collect()
        
        logger.info(
            f"Detected {len(all_detections)} clauses "
            f"across {len(chunks)} chunks"
        )
        return all_detections
    
    def unload_model(self):
        """Explicitly unload the model to free memory.
        
        Call this after you're done with detection to reclaim RAM/VRAM.
        """
        if self.model is not None:
            del self.model
            self.model = None
        if self.tokenizer is not None:
            del self.tokenizer
            self.tokenizer = None
        gc.collect()
        # Free GPU VRAM if we were using CUDA
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        if hasattr(self, '_torch'):
            del self._torch
        logger.info("QA model unloaded to free memory.")
