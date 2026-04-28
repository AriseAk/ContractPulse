"""
QA Model Training Script
=========================
Fine-tunes a QA model (roberta-base or squad2 warm-start) on the CUAD dataset.

CUAD contexts are full contracts (avg 54K chars).
We use sliding window tokenization to create 384-token windows
with 128-token overlap — this is how SQuAD-style models handle long documents.

Memory Safety:
    - Default batch_size=2 to avoid RAM exhaustion on laptops
    - Default max_train_samples=500 (use --max_train_samples=-1 for full dataset)
    - Aggressive garbage collection after data transformations
    - Tokenization uses small batch sizes to limit peak memory

Usage:
    python -m src.train_qa                           # defaults (safe)
    python -m src.train_qa --epochs 3 --batch_size 4
    python -m src.train_qa --base_model deepset/roberta-base-squad2
    python -m src.train_qa --max_train_samples -1    # full dataset (needs 16GB+ RAM)
"""

import argparse
import functools
import gc
import json
import logging
import os
import sys
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)


def load_cuad_data(filepath: str) -> Dict:
    """Load a CUAD JSON file (SQuAD 2.0 format)."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


def cuad_to_squad_examples(data: Dict) -> List[Dict]:
    """Convert CUAD data to a flat list of SQuAD-style examples.
    
    Each example has: id, question, context, answers, is_impossible.
    """
    examples = []
    for article in data["data"]:
        title = article.get("title", "")
        for paragraph in article["paragraphs"]:
            context = paragraph["context"]
            for qa in paragraph["qas"]:
                example = {
                    "id": qa["id"],
                    "title": title,
                    "question": qa["question"],
                    "context": context,
                    "answers": {
                        "text": [a["text"] for a in qa.get("answers", [])],
                        "answer_start": [a["answer_start"] for a in qa.get("answers", [])],
                    },
                    "is_impossible": qa.get("is_impossible", False),
                }
                examples.append(example)
    return examples


def prepare_train_features(examples, tokenizer, max_length=384, doc_stride=128):
    """Prepare training features with sliding window tokenization.
    
    Handles long documents by creating overlapping windows.
    Maps answer spans to the correct window positions.
    """
    pad_on_right = tokenizer.padding_side == "right"
    
    tokenized = tokenizer(
        examples["question"] if pad_on_right else examples["context"],
        examples["context"] if pad_on_right else examples["question"],
        truncation="only_second" if pad_on_right else "only_first",
        max_length=max_length,
        stride=doc_stride,
        return_overflowing_tokens=True,
        return_offsets_mapping=True,
        padding="max_length",
    )
    
    sample_mapping = tokenized.pop("overflow_to_sample_mapping")
    offset_mapping = tokenized.pop("offset_mapping")
    
    tokenized["start_positions"] = []
    tokenized["end_positions"] = []
    
    for i, offsets in enumerate(offset_mapping):
        input_ids = tokenized["input_ids"][i]
        cls_index = input_ids.index(tokenizer.cls_token_id)
        
        sequence_ids = tokenized.sequence_ids(i)
        sample_index = sample_mapping[i]
        answers = examples["answers"][sample_index]
        
        if examples["is_impossible"][sample_index] or len(answers["answer_start"]) == 0:
            tokenized["start_positions"].append(cls_index)
            tokenized["end_positions"].append(cls_index)
        else:
            start_char = answers["answer_start"][0]
            end_char = start_char + len(answers["text"][0])
            
            token_start_index = 0
            while sequence_ids[token_start_index] != (1 if pad_on_right else 0):
                token_start_index += 1
            
            token_end_index = len(input_ids) - 1
            while sequence_ids[token_end_index] != (1 if pad_on_right else 0):
                token_end_index -= 1
            
            if not (
                offsets[token_start_index][0] <= start_char
                and offsets[token_end_index][1] >= end_char
            ):
                tokenized["start_positions"].append(cls_index)
                tokenized["end_positions"].append(cls_index)
            else:
                while (
                    token_start_index < len(offsets)
                    and offsets[token_start_index][0] <= start_char
                ):
                    token_start_index += 1
                tokenized["start_positions"].append(token_start_index - 1)
                
                while offsets[token_end_index][1] >= end_char:
                    token_end_index -= 1
                tokenized["end_positions"].append(token_end_index + 1)
    
    return tokenized


def _tokenize_wrapper(examples, tokenizer, max_length, doc_stride):
    """Top-level wrapper so it can be pickled for multiprocessing on Windows."""
    return prepare_train_features(examples, tokenizer, max_length, doc_stride)


def train(
    train_path: str = "data/train.json",
    test_path: str = "data/test.json",
    base_model: str = "deepset/roberta-base-squad2",
    output_dir: str = "ckpt_obligation",
    epochs: int = 2,
    batch_size: int = 16,
    learning_rate: float = 3e-5,
    max_length: int = 384,
    doc_stride: int = 128,
    max_train_samples: int = None,
    device: str = "auto",
):
    """Fine-tune a QA model on CUAD data.
    
    Args:
        train_path: Path to CUAD train.json
        test_path: Path to CUAD test.json
        base_model: HuggingFace model name to fine-tune
        output_dir: Directory to save the fine-tuned model
        epochs: Number of training epochs (2 is enough when warm-starting from squad2)
        batch_size: Training batch size (16 fits in RTX 4050 6GB VRAM with fp16)
        learning_rate: Learning rate
        max_length: Maximum sequence length for tokenizer
        doc_stride: Sliding window stride for long documents
        max_train_samples: Limit training samples (default 500, use -1 for all)
        device: 'auto' (detect GPU), 'cuda', or 'cpu'
    """
    # ─── Imports (done here to allow module to be imported without torch) ─
    try:
        import torch
        from datasets import Dataset
        from transformers import (
            AutoModelForQuestionAnswering,
            AutoTokenizer,
            TrainingArguments,
            Trainer,
            default_data_collator,
        )
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Install with: pip install torch transformers datasets")
        sys.exit(1)
    
    # ─── Resolve device ──────────────────────────────────────────────────
    from all_model_code.model_1_code.utils import get_device, get_safe_train_samples
    device = get_device(device)
    logger.info(f"Training device: {device}")
    
    # ─── Handle max_train_samples ─────────────────────────────────────────
    # -1 means "force all regardless of RAM" (user knows what they're doing)
    force_all = (max_train_samples is not None and max_train_samples < 0)
    if force_all:
        max_train_samples = None
    
    # ─── Load Data ───────────────────────────────────────────────────────
    logger.info(f"Loading training data from {train_path}")
    train_data = load_cuad_data(train_path)
    train_examples = cuad_to_squad_examples(train_data)
    logger.info(f"  → {len(train_examples)} training examples")
    
    # Free the raw JSON immediately — it's huge and no longer needed
    del train_data
    gc.collect()
    
    # NOTE: test data is NOT loaded here to save memory.
    # Evaluation should be done separately via src.evaluate.
    
    # ─── Auto-detect safe sample count if no explicit limit ──────────────
    if max_train_samples is None and not force_all:
        max_train_samples = get_safe_train_samples(len(train_examples))
    
    # ─── Create HuggingFace Datasets ─────────────────────────────────────
    # Convert to column-oriented format for HF datasets
    def examples_to_columns(examples):
        columns = {
            "id": [], "question": [], "context": [],
            "answers": [], "is_impossible": [],
        }
        for ex in examples:
            columns["id"].append(ex["id"])
            columns["question"].append(ex["question"])
            columns["context"].append(ex["context"])
            columns["answers"].append(ex["answers"])
            columns["is_impossible"].append(ex["is_impossible"])
        return columns
    
    train_dataset = Dataset.from_dict(examples_to_columns(train_examples))
    
    # Free the examples list — dataset holds the data now
    del train_examples
    gc.collect()
    
    if max_train_samples and max_train_samples < len(train_dataset):
        train_dataset = train_dataset.select(range(max_train_samples))
        logger.info(f"  Using {len(train_dataset)} training samples")
    
    # ─── Load Tokenizer & Model ──────────────────────────────────────────
    logger.info(f"Loading model: {base_model}")
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    model = AutoModelForQuestionAnswering.from_pretrained(base_model)
    
    # ─── Tokenize (with disk cache) ────────────────────────────────────
    # CUAD contracts are huge (~54K chars each × 22K examples).
    # Tokenization takes ~50 min, so we cache to disk after the first run.
    # Cache is keyed by sample count so changing --max_train_samples auto-invalidates.
    os.environ["TOKENIZERS_PARALLELISM"] = "true"  # Rust-level threading
    
    num_samples = len(train_dataset)
    cache_dir = os.path.join(output_dir, "tokenized_cache")
    cache_path = os.path.join(cache_dir, f"tokenized_train_{num_samples}")
    
    if os.path.exists(cache_path):
        from datasets import load_from_disk
        logger.info(f"Loading cached tokenized data from {cache_path}")
        tokenized_train = load_from_disk(cache_path)
        logger.info(f"  → {len(tokenized_train)} cached features loaded instantly!")
    else:
        logger.info(f"Tokenizing {num_samples} training examples (sliding window) — this only happens once per sample count...")
        tokenized_train = train_dataset.map(
            lambda ex: prepare_train_features(ex, tokenizer, max_length, doc_stride),
            batched=True,
            batch_size=100,  # small batch to limit peak memory
            remove_columns=train_dataset.column_names,
            desc="Tokenizing",
        )
        # Save to disk so next run skips this entirely
        os.makedirs(cache_dir, exist_ok=True)
        tokenized_train.save_to_disk(cache_path)
        logger.info(f"  → Tokenized data cached to {cache_path}")
    
    # Free the un-tokenized dataset
    del train_dataset
    gc.collect()
    
    logger.info(f"  → {len(tokenized_train)} tokenized features (from sliding windows)")
    
    # ─── Training Arguments ──────────────────────────────────────────────
    use_gpu = (device == "cuda")
    training_args = TrainingArguments(
        output_dir=output_dir,
        overwrite_output_dir=True,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        learning_rate=learning_rate,
        weight_decay=0.01,
        warmup_ratio=0.1,
        logging_steps=50,
        save_strategy="epoch",
        save_total_limit=1,  # keep only 1 checkpoint to save disk/memory
        fp16=use_gpu,  # FP16 on GPU for ~2x memory savings
        report_to="none",
        use_cpu=(not use_gpu),
        dataloader_num_workers=0,  # avoid multiprocessing memory overhead on Windows
        dataloader_pin_memory=use_gpu,  # pin_memory speeds up GPU, wastes RAM on CPU
    )
    
    # ─── Trainer ─────────────────────────────────────────────────────────
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_train,
        tokenizer=tokenizer,
        data_collator=default_data_collator,
    )
    
    # ─── Train ───────────────────────────────────────────────────────────
    logger.info("Starting training...")
    trainer.train()
    
    # ─── Save ────────────────────────────────────────────────────────────
    logger.info(f"Saving model to {output_dir}")
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    
    logger.info("Training complete!")
    return output_dir


def main():
    parser = argparse.ArgumentParser(description="Fine-tune QA model on CUAD")
    parser.add_argument("--train_path", default="data/train.json")
    parser.add_argument("--test_path", default="data/test.json")
    parser.add_argument("--base_model", default="deepset/roberta-base-squad2")
    parser.add_argument("--output_dir", default="ckpt_obligation")
    parser.add_argument("--epochs", type=int, default=2,
                        help="Training epochs (2 is enough when warm-starting from squad2)")
    parser.add_argument("--batch_size", type=int, default=16,
                        help="Batch size (16 fits RTX 4050 6GB VRAM with fp16)")
    parser.add_argument("--learning_rate", type=float, default=3e-5)
    parser.add_argument("--max_length", type=int, default=384)
    parser.add_argument("--doc_stride", type=int, default=128)
    parser.add_argument("--max_train_samples", type=int, default=None,
                        help="Limit training samples. Default: auto-detect based on RAM. Use -1 to force ALL.")
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"],
                        help="Device: 'auto' detects GPU, 'cuda' forces GPU, 'cpu' forces CPU")
    
    args = parser.parse_args()
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    
    train(**vars(args))


if __name__ == "__main__":
    main()
