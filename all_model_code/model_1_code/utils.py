"""
Shared Utilities
================
Common helpers used across the pipeline.
"""

import logging
import os

logger = logging.getLogger(__name__)


def get_device(preferred: str = "auto") -> str:
    """Determine the best available device for PyTorch.
    
    Auto-detects CUDA GPU and falls back to CPU.
    
    Args:
        preferred: 'auto' (detect GPU), 'cuda', or 'cpu'.
                   'auto' will use CUDA if available, else CPU.
    
    Returns:
        Device string: 'cuda' or 'cpu'.
    """
    if preferred == "cpu":
        return "cpu"
    
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            vram_mb = torch.cuda.get_device_properties(0).total_memory / 1024 / 1024
            logger.info(f"GPU detected: {gpu_name} ({vram_mb:.0f} MB VRAM)")
            return "cuda"
        else:
            if preferred == "cuda":
                logger.warning("CUDA requested but not available, falling back to CPU")
            return "cpu"
    except ImportError:
        return "cpu"


def get_available_ram_gb() -> float:
    """Get available system RAM in GB.
    
    Uses psutil if available, falls back to OS-level checks.
    Returns a conservative estimate if detection fails.
    """
    # Try psutil first (most accurate)
    try:
        import psutil
        return psutil.virtual_memory().available / (1024 ** 3)
    except ImportError:
        pass
    
    # Windows fallback: use ctypes
    try:
        import ctypes
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]
        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(stat)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
        return stat.ullAvailPhys / (1024 ** 3)
    except Exception:
        pass
    
    # Last resort: assume 8GB total, ~4GB available (conservative)
    logger.warning("Could not detect available RAM, assuming 4 GB available")
    return 4.0


def get_safe_train_samples(total_examples: int) -> int:
    """Determine a safe number of training samples based on available RAM.
    
    CUAD training is RAM-intensive because:
    - Each example contains a ~54K char contract context
    - 22K examples × 54K chars = ~1.2 GB just for raw strings  
    - Column conversion + tokenization roughly triples peak memory
    - Sliding window tokenization expands 22K examples → ~1.1M features
    
    Memory estimates (approximate):
        - 1000 samples → ~1 GB peak RAM
        - 5000 samples → ~3 GB peak RAM  
        - 10000 samples → ~5 GB peak RAM
        - 22000 samples → ~10 GB peak RAM
    
    Args:
        total_examples: Total number of available training examples.
    
    Returns:
        Safe number of samples to use.
    """
    available_gb = get_available_ram_gb()
    
    # Reserve ~3 GB for OS + Python + PyTorch model + overhead
    usable_gb = max(available_gb - 3.0, 1.0)
    
    # ~500 MB per 1000 samples during peak tokenization
    safe_samples = int(usable_gb * 2000)
    
    # Clamp to actual dataset size
    safe_samples = min(safe_samples, total_examples)
    
    # Minimum floor of 500 (below this, training is meaningless)
    safe_samples = max(safe_samples, min(500, total_examples))
    
    if safe_samples < total_examples:
        logger.warning(
            f"Available RAM: {available_gb:.1f} GB → limiting to {safe_samples} samples "
            f"(out of {total_examples}) to prevent crashes. "
            f"Use --max_train_samples {total_examples} to force all."
        )
    else:
        logger.info(
            f"Available RAM: {available_gb:.1f} GB → using all {total_examples} samples"
        )
    
    return safe_samples
