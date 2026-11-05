import json
import hashlib
from typing import List, Dict, Any, Optional
from app.llm.base import LlmProvider
from app.llm.schemas import DocDraft, SectionDraft, Evidence, CodeEntityRef
from app.llm.secret_masker import mask_secrets

class MockProvider(LlmProvider):
    """
    Deterministic Mock LLM Provider for unit testing and offline development.
    Produces structured Markdown matching templates and code entities without external network/API keys.
    """

    def __init__(self, model_name: str = "mock-model-v1"):
        self.model_name = model_name

    def generate_doc(
        self,
        entities: List[Dict[str, Any]],
        template: Dict[str, Any],
        options: Optional[Dict[str, Any]] = None
    ) -> DocDraft:
        options = options or {}
        commit_ref = options.get("commit_sha", "HEAD")
        template_name = template.get("name", "Document")
        doc_type = template.get("doc_type", "README")
        
        # Parse template sections
        raw_sections = template.get("sections", [])
        if isinstance(raw_sections, str):
            try:
                raw_sections = json.loads(raw_sections)
            except Exception:
                raw_sections = []
        if isinstance(raw_sections, dict) and "sections" in raw_sections:
            raw_sections = raw_sections["sections"]

        # Default fallback sections if none provided
        if not raw_sections:
            raw_sections = [
                {"key": "overview", "title": "Overview", "required": True},
                {"key": "details", "title": "Details", "required": True}
            ]

        # Extract code entities & evidences
        parsed_entity_refs: List[CodeEntityRef] = []
        source_files_set = set()
        evidence_list: List[Evidence] = []

        for e in entities:
            # Mask secret in name or docstring if present
            name = mask_secrets(str(e.get("name", "Unnamed")))
            kind = e.get("kind", "entity")
            file_path = e.get("file_path", "unknown/path")
            line_start = e.get("line_start")
            line_end = e.get("line_end")
            snippet = mask_secrets(str(e.get("snippet", "")))

            ref = CodeEntityRef(
                id=str(e.get("id")) if e.get("id") else None,
                name=name,
                kind=kind,
                file_path=file_path,
                line_start=line_start,
                line_end=line_end
            )
            parsed_entity_refs.append(ref)
            source_files_set.add(file_path)

            evidence_list.append(Evidence(
                source_file=file_path,
                entity_name=name,
                entity_kind=kind,
                line_range=f"{line_start}-{line_end}" if line_start and line_end else None,
                snippet=snippet[:200] if snippet else None
            ))

        source_files = sorted(list(source_files_set)) if source_files_set else ["src/main"]

        # Generate sections deterministically
        section_drafts: List[SectionDraft] = []
        full_markdown_parts = [f"# {template_name}\n\n*Auto-generated document draft by AI*\n"]

        total_confidence = 0.0

        for sec in raw_sections:
            sec_key = sec.get("key", "section")
            sec_title = sec.get("title", sec_key.capitalize())
            entity_kind = sec.get("entity_kind")

            # Deterministic section confidence calculation based on hash
            hash_input = f"{sec_key}:{template_name}:{len(entities)}"
            hash_val = int(hashlib.md5(hash_input.encode('utf-8')).hexdigest()[:4], 16)
            # Conf between 0.85 and 0.98
            sec_confidence = round(0.85 + (hash_val % 14) / 100.0, 2)
            total_confidence += sec_confidence

            # Build section content
            sec_content_lines = []
            if sec_key == "overview" or sec_key == "welcome" or sec_key == "purpose":
                sec_content_lines.append(f"This document provides the {sec_title.lower()} for `{template_name}`.")
                if source_files:
                    sec_content_lines.append(f"Primary source components: {', '.join(source_files)}.")
            elif sec_key in ["endpoints", "classes", "parameters"]:
                matched_entities = [e for e in parsed_entity_refs if not entity_kind or e.kind.lower() == entity_kind.lower()]
                if not matched_entities:
                    matched_entities = parsed_entity_refs

                if matched_entities:
                    sec_content_lines.append(f"| Name | Kind | File |")
                    sec_content_lines.append(f"|---|---|---|")
                    for me in matched_entities:
                        sec_content_lines.append(f"| `{me.name}` | {me.kind} | `{me.file_path}` |")
                else:
                    sec_content_lines.append(f"No specific {sec_title.lower()} detected in analyzed scope.")
            else:
                sec_content_lines.append(f"Documentation details for section **{sec_title}**.")
                if parsed_entity_refs:
                    sec_content_lines.append(f"Referenced entities: {', '.join([f'`{e.name}`' for e in parsed_entity_refs[:5]])}.")

            sec_content = "\n\n".join(sec_content_lines)
            sec_evidence = [ev for ev in evidence_list if ev.entity_kind == entity_kind] if entity_kind else evidence_list[:3]

            section_drafts.append(SectionDraft(
                section_key=sec_key,
                section_title=sec_title,
                content=sec_content,
                confidence=sec_confidence,
                evidence=sec_evidence
            ))

            full_markdown_parts.append(f"## {sec_title}\n\n{sec_content}\n")

        overall_conf = round(total_confidence / len(section_drafts), 2) if section_drafts else 0.90
        markdown_content = "\n".join(full_markdown_parts)

        return DocDraft(
            document_title=template_name,
            doc_type=doc_type,
            markdown_content=markdown_content,
            sections=section_drafts,
            overall_confidence=overall_conf,
            evidence_list=evidence_list,
            source_files=source_files,
            code_entity_references=parsed_entity_refs,
            commit_reference=commit_ref
        )

