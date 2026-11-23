import re
from typing import Dict, Any, List

# Patterns matching sensitive keys, tokens, credentials, and passwords
PATTERNS = [
    (re.compile(r'(?i)(api[_-]?key\s*[:=]\s*["\']?)([A-Za-z0-9_\-\.]{8,})(["\']?)'), r'\1***MASKED***\3'),
    (re.compile(r'(?i)(bearer\s+)([A-Za-z0-9\-\._~\+\/]+=*)'), r'\1***MASKED***'),
    (re.compile(r'(?i)(password\s*[:=]\s*["\']?)([^"\'\s\r\n]{4,})(["\']?)'), r'\1***MASKED***\3'),
    (re.compile(r'(?i)(secret\s*[:=]\s*["\']?)([^"\'\s\r\n]{4,})(["\']?)'), r'\1***MASKED***\3'),
    (re.compile(r'(?i)(token\s*[:=]\s*["\']?)([^"\'\s\r\n]{4,})(["\']?)'), r'\1***MASKED***\3'),
    (re.compile(r'(?i)(ghp_[A-Za-z0-9]{30,})'), r'ghp_***MASKED***'),
    (re.compile(r'(?i)(gho_[A-Za-z0-9]{30,})'), r'gho_***MASKED***'),
    (re.compile(r'(?i)(AKIA[0-9A-Z]{16})'), r'AKIA***MASKED***'),
]

def mask_secrets(text: str) -> str:
    """
    Masks common secrets such as API keys, bearer tokens, passwords, and tokens.
    Preserves regular text.
    """
    if not text:
        return text
    
    masked = text
    for pattern, replacement in PATTERNS:
        masked = pattern.sub(replacement, masked)
    return masked

def contains_secret(text: str) -> bool:
    """
    Returns True if any sensitive pattern is detected in the input text.
    """
    if not text:
        return False
    return any(pattern.search(text) is not None for pattern, _ in PATTERNS)

