from __future__ import annotations

import os
from pathlib import Path
from typing import Optional, Sequence, Union

from .models import CodeEntity
from .parsers.java_parser import JavaAstParser
from .parsers.python_parser import PythonAstParser

_java_parser: Optional[JavaAstParser] = None
_python_parser: Optional[PythonAstParser] = None


def get_java_parser() -> JavaAstParser:
    global _java_parser
    if _java_parser is None:
        _java_parser = JavaAstParser()
    return _java_parser


def get_python_parser() -> PythonAstParser:
    global _python_parser
    if _python_parser is None:
        _python_parser = PythonAstParser()
    return _python_parser


def analyze(
    files: Sequence[Union[str, Path]],
    language: str,
    commit: str,
    repository_id: Optional[str] = None,
) -> list[CodeEntity]:
    """
    Phân tích AST các file mã nguồn và trích xuất danh sách CodeEntity.
    
    Yêu cầu SRS:
    - FR-GEN-01: Bóc tách class, method, endpoint, parameter.
    - FR-DR-13: Tính tất định - cùng đầu vào thì cùng kết quả.
    
    :param files: Danh sách đường dẫn tệp mã nguồn.
    :param language: 'java' hoặc 'python'.
    :param commit: Hash của commit.
    :param repository_id: (Tùy chọn) UUID của repository trong CSDL.
    :return: Danh sách CodeEntity đã trích xuất.
    """
    lang_norm = language.strip().lower()
    if lang_norm in ("java", ".java"):
        parser = get_java_parser()
    elif lang_norm in ("python", "py", ".py"):
        parser = get_python_parser()
    else:
        raise ValueError(f"Ngôn ngữ '{language}' chưa được hỗ trợ. Chỉ hỗ trợ 'java' hoặc 'python'.")

    all_entities: list[CodeEntity] = []

    # Sắp xếp danh sách file để đảm bảo tính tất định (Deterministic)
    sorted_files = sorted([str(f) for f in files])

    for file_item in sorted_files:
        path_obj = Path(file_item)
        if not path_obj.exists() or not path_obj.is_file():
            continue

        try:
            content = path_obj.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        rel_path = str(path_obj).replace("\\", "/")
        extracted = parser.parse(
            content=content,
            file_path=rel_path,
            commit_hash=commit,
            repository_id=repository_id,
        )
        all_entities.extend(extracted)

    return all_entities
