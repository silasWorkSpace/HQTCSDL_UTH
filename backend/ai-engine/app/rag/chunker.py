"""Knowledge chunking and secret masking for code snapshots and document versions."""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict, List, Optional
from app.llm.secret_masker import mask_secrets


def compute_checksum(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def chunk_source_file(
    file_path: str,
    content: str,
    commit_sha: str,
    repository_id: str,
    entities: Optional[List[Dict[str, Any]]] = None,
    max_chunk_lines: int = 80
) -> List[Dict[str, Any]]:
    """
    Split a source code file into chunks preserved with commit provenance.
    If entities are provided, chunk boundaries align with parsed entities.
    """
    masked_content = mask_secrets(content)
    lines = masked_content.splitlines(keepends=True)
    chunks: List[Dict[str, Any]] = []

    if entities:
        def _get_val(e: Any, k: str, default: Any = None) -> Any:
            return e.get(k, default) if isinstance(e, dict) else getattr(e, k, default)

        # Sort entities by line_start
        sorted_entities = sorted(
            [e for e in entities if _get_val(e, "file_path") == file_path and _get_val(e, "line_start") is not None],
            key=lambda e: _get_val(e, "line_start", 0)
        )
        for ent in sorted_entities:
            start = max(1, _get_val(ent, "line_start", 1)) - 1
            end = min(len(lines), _get_val(ent, "line_end", len(lines)))
            chunk_text = "".join(lines[start:end]).strip()
            if not chunk_text:
                continue

            entity_id = _get_val(ent, "id")
            entity_name = _get_val(ent, "name")
            entity_links = json.dumps([str(entity_id)] if entity_id else ([str(entity_name)] if entity_name else []))

            chunks.append({
                "repository_id": repository_id,
                "document_id": None,
                "document_version_id": None,
                "commit_sha": commit_sha,
                "file_path": file_path,
                "chunk_type": "CODE",
                "content": chunk_text,
                "checksum": compute_checksum(chunk_text),
                "entity_links": entity_links,
            })

    # If no entities or file not covered by entities, fallback to line-window chunks
    if not chunks and lines:
        for i in range(0, len(lines), max_chunk_lines):
            chunk_text = "".join(lines[i:i + max_chunk_lines]).strip()
            if chunk_text:
                chunks.append({
                    "repository_id": repository_id,
                    "document_id": None,
                    "document_version_id": None,
                    "commit_sha": commit_sha,
                    "file_path": file_path,
                    "chunk_type": "CODE",
                    "content": chunk_text,
                    "checksum": compute_checksum(chunk_text),
                    "entity_links": json.dumps([]),
                })

    return chunks


def chunk_document(
    document_id: str,
    version_no: int,
    content: str,
    document_version_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Split markdown documentation into chunks by markdown headers (#, ##, ###).
    """
    masked = mask_secrets(content)
    sections = re.split(r"(?m)(?=^#{1,3}\s+)", masked)
    chunks: List[Dict[str, Any]] = []

    for sec in sections:
        sec_text = sec.strip()
        if not sec_text:
            continue
        chunks.append({
            "repository_id": None,
            "document_id": document_id,
            "document_version_id": document_version_id,
            "commit_sha": None,
            "file_path": None,
            "chunk_type": "DOCUMENT",
            "content": sec_text,
            "checksum": compute_checksum(sec_text),
            "entity_links": json.dumps([]),
        })

    return chunks
