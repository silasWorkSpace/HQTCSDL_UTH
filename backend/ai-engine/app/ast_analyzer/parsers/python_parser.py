from __future__ import annotations

import re
from typing import Optional
import tree_sitter_python as tspython
from tree_sitter import Language, Node, Parser

from ..models import CodeEntity, generate_entity_id
from .base_parser import BaseAstParser


class PythonAstParser(BaseAstParser):
    def __init__(self) -> None:
        self.language = Language(tspython.language())
        self.parser = Parser(self.language)

    def parse(
        self,
        content: str,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str] = None,
    ) -> list[CodeEntity]:
        if not content.strip():
            return []

        tree = self.parser.parse(content.encode("utf-8", errors="ignore"))
        entities: list[CodeEntity] = []

        self._walk_node(
            node=tree.root_node,
            file_path=file_path,
            commit_hash=commit_hash,
            repository_id=repository_id,
            entities=entities,
            parent_id=None,
        )

        return entities

    def _walk_node(
        self,
        node: Node,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str],
        entities: list[CodeEntity],
        parent_id: Optional[str],
    ) -> None:
        for child in node.children:
            if child.type == "class_definition":
                class_entity = self._extract_class(child, file_path, commit_hash, repository_id, parent_id)
                if class_entity:
                    entities.append(class_entity)
                    body_node = child.child_by_field_name("body")
                    if body_node:
                        self._walk_node(
                            body_node,
                            file_path,
                            commit_hash,
                            repository_id,
                            entities,
                            parent_id=class_entity.id,
                        )
            elif child.type == "decorated_definition":
                inner_class = None
                inner_func = None
                for c in child.children:
                    if c.type == "class_definition":
                        inner_class = c
                    elif c.type == "function_definition":
                        inner_func = c

                if inner_class:
                    class_entity = self._extract_class(inner_class, file_path, commit_hash, repository_id, parent_id)
                    if class_entity:
                        entities.append(class_entity)
                        body_node = inner_class.child_by_field_name("body")
                        if body_node:
                            self._walk_node(
                                body_node,
                                file_path,
                                commit_hash,
                                repository_id,
                                entities,
                                parent_id=class_entity.id,
                            )
                else:
                    func_entity, endpoint_entity, param_entities = self._extract_function(
                        child, file_path, commit_hash, repository_id, parent_id
                    )
                    if func_entity:
                        entities.append(func_entity)
                        if endpoint_entity:
                            entities.append(endpoint_entity)
                        entities.extend(param_entities)
            elif child.type == "function_definition":
                func_entity, endpoint_entity, param_entities = self._extract_function(
                    child, file_path, commit_hash, repository_id, parent_id
                )
                if func_entity:
                    entities.append(func_entity)
                    if endpoint_entity:
                        entities.append(endpoint_entity)
                    entities.extend(param_entities)
            else:
                self._walk_node(child, file_path, commit_hash, repository_id, entities, parent_id)

    def _extract_class(
        self,
        node: Node,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str],
        parent_id: Optional[str],
    ) -> Optional[CodeEntity]:
        name_node = node.child_by_field_name("name")
        if not name_node or not name_node.text:
            return None

        class_name = name_node.text.decode("utf-8", errors="ignore")
        superclasses_node = node.child_by_field_name("superclasses")
        bases_str = ""
        if superclasses_node and superclasses_node.text:
            bases_str = superclasses_node.text.decode("utf-8", errors="ignore")

        signature = f"class {class_name}{bases_str}"

        class_id = generate_entity_id(
            repository_id=repository_id,
            commit_hash=commit_hash,
            file_path=file_path,
            kind="class",
            name=class_name,
            signature=signature,
            parent_id=parent_id,
        )

        return CodeEntity(
            id=class_id,
            name=class_name,
            kind="class",
            file_path=file_path,
            commit_hash=commit_hash,
            repository_id=repository_id,
            parent_id=parent_id,
            signature=signature,
        )

    def _extract_function(
        self,
        node: Node,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str],
        parent_id: Optional[str],
    ) -> tuple[Optional[CodeEntity], Optional[CodeEntity], list[CodeEntity]]:
        decorators: list[str] = []
        actual_func_node = node

        if node.type == "decorated_definition":
            for child in node.children:
                if child.type == "decorator":
                    dec_text = child.text.decode("utf-8", errors="ignore").strip()
                    decorators.append(dec_text)
                elif child.type == "function_definition":
                    actual_func_node = child

        name_node = actual_func_node.child_by_field_name("name")
        if not name_node or not name_node.text:
            return None, None, []

        func_name = name_node.text.decode("utf-8", errors="ignore")

        # Return type
        return_type = "None"
        return_type_node = actual_func_node.child_by_field_name("return_type")
        if return_type_node and return_type_node.text:
            return_type = return_type_node.text.decode("utf-8", errors="ignore").strip()

        # Parameters
        params_node = actual_func_node.child_by_field_name("parameters")
        param_list_strs = []
        raw_params = []

        if params_node:
            for child in params_node.children:
                if child.type in (
                    "identifier",
                    "typed_parameter",
                    "default_parameter",
                    "typed_default_parameter",
                ):
                    p_text = child.text.decode("utf-8", errors="ignore").strip()
                    p_name = self._extract_param_name(child, p_text)
                    if p_name and p_name != "self" and p_name != "cls":
                        param_list_strs.append(p_text)
                        raw_params.append((p_name, p_text))
                    elif p_name in ("self", "cls"):
                        param_list_strs.append(p_name)

        params_str = ", ".join(param_list_strs)
        is_async = any(c.type == "async" for c in actual_func_node.children)
        prefix = "async def" if is_async else "def"
        func_sig = f"{prefix} {func_name}({params_str}) -> {return_type}"

        func_id = generate_entity_id(
            repository_id=repository_id,
            commit_hash=commit_hash,
            file_path=file_path,
            kind="method",
            name=func_name,
            signature=func_sig,
            parent_id=parent_id,
        )

        func_entity = CodeEntity(
            id=func_id,
            name=func_name,
            kind="method",
            file_path=file_path,
            commit_hash=commit_hash,
            repository_id=repository_id,
            parent_id=parent_id,
            signature=func_sig,
        )

        param_entities: list[CodeEntity] = []
        for idx, (p_name, p_text) in enumerate(raw_params):
            param_id = generate_entity_id(
                repository_id=repository_id,
                commit_hash=commit_hash,
                file_path=file_path,
                kind="parameter",
                name=p_name,
                signature=p_text,
                parent_id=func_entity.id,
                index=idx,
            )
            param_entity = CodeEntity(
                id=param_id,
                name=p_name,
                kind="parameter",
                file_path=file_path,
                commit_hash=commit_hash,
                repository_id=repository_id,
                parent_id=func_entity.id,
                signature=p_text,
            )
            param_entities.append(param_entity)

        # Detect FastAPI / Flask endpoint decorator
        endpoint_entity = self._detect_endpoint(decorators, func_entity, file_path, commit_hash, repository_id)

        return func_entity, endpoint_entity, param_entities

    def _detect_endpoint(
        self,
        decorators: list[str],
        func_entity: CodeEntity,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str],
    ) -> Optional[CodeEntity]:
        # Examples: @app.get("/users"), @router.post("/items/{item_id}", response_model=Item)
        pattern = re.compile(
            r"^@(?:\w+\.)?(get|post|put|delete|patch|api_route)\s*\(\s*[\"']([^\"']*)[\"']",
            re.IGNORECASE,
        )
        for dec in decorators:
            match = pattern.search(dec)
            if match:
                http_verb = match.group(1).upper()
                route_path = match.group(2)
                if not route_path.startswith("/"):
                    route_path = "/" + route_path

                endpoint_name = f"{http_verb} {route_path}"
                endpoint_sig = f"{http_verb} {route_path} -> {func_entity.signature}"

                endpoint_id = generate_entity_id(
                    repository_id=repository_id,
                    commit_hash=commit_hash,
                    file_path=file_path,
                    kind="endpoint",
                    name=endpoint_name,
                    signature=endpoint_sig,
                    parent_id=func_entity.id,
                )

                return CodeEntity(
                    id=endpoint_id,
                    name=endpoint_name,
                    kind="endpoint",
                    file_path=file_path,
                    commit_hash=commit_hash,
                    repository_id=repository_id,
                    parent_id=func_entity.id,
                    signature=endpoint_sig,
                )
        return None

    @staticmethod
    def _extract_param_name(node: Node, text: str) -> str:
        if node.type == "identifier":
            return text
        name_child = node.child_by_field_name("name")
        if name_child and name_child.text:
            return name_child.text.decode("utf-8", errors="ignore")
        # Fallback split
        return text.split(":")[0].split("=")[0].strip()
