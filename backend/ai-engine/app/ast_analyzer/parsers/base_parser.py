from abc import ABC, abstractmethod
from typing import Optional
from ..models import CodeEntity


class BaseAstParser(ABC):
    @abstractmethod
    def parse(
        self,
        content: str,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str] = None,
    ) -> list[CodeEntity]:
        """Parse source code string and extract CodeEntity records."""
        pass
