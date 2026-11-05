from __future__ import annotations

import re
from typing import Optional
import tree_sitter_java as tsjava
from tree_sitter import Language, Node, Parser

from ..models import CodeEntity
from .base_parser import BaseAstParser


class JavaAstParser(BaseAstParser):
    def __init__(self) -> None:
        self.language = Language(tsjava.language())
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
            parent_class_id=None,
            base_route="",
        )

        return entities

    def _get_child_by_type(self, node: Node, child_type: str) -> Optional[Node]:
        for child in node.children:
            if child.type == child_type:
                return child
        return None

    def _walk_node(
        self,
        node: Node,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str],
        entities: list[CodeEntity],
        parent_class_id: Optional[str],
        base_route: str,
    ) -> None:
        for child in node.children:
            if child.type in (
                "class_declaration",
                "interface_declaration",
                "record_declaration",
                "enum_declaration",
            ):
                class_entity, class_route = self._extract_class(
                    child, file_path, commit_hash, repository_id, parent_class_id
                )
                if class_entity:
                    entities.append(class_entity)
                    # Traverse class body with class_entity.id as parent
                    class_body = self._get_child_by_type(child, "class_body") or child.child_by_field_name("body")
                    if class_body:
                        self._walk_class_body(
                            class_body,
                            file_path,
                            commit_hash,
                            repository_id,
                            entities,
                            parent_class_id=class_entity.id,
                            base_route=class_route or base_route,
                        )
            else:
                self._walk_node(
                    child,
                    file_path,
                    commit_hash,
                    repository_id,
                    entities,
                    parent_class_id,
                    base_route,
                )

    def _extract_class(
        self,
        node: Node,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str],
        parent_id: Optional[str],
    ) -> tuple[Optional[CodeEntity], str]:
        name_node = self._get_child_by_type(node, "identifier") or node.child_by_field_name("name")
        if not name_node or not name_node.text:
            return None, ""

        class_name = name_node.text.decode("utf-8", errors="ignore")
        modifiers_node = self._get_child_by_type(node, "modifiers") or node.child_by_field_name("modifiers")
        annotations = self._extract_annotations(modifiers_node) if modifiers_node else []

        # Find base route from @RequestMapping
        base_route = ""
        for ann_name, ann_val in annotations:
            if ann_name in ("RequestMapping", "org.springframework.web.bind.annotation.RequestMapping"):
                base_route = ann_val or ""
                break

        # Construct signature e.g. "public class OrderController"
        sig_parts = []
        if modifiers_node:
            for mod in modifiers_node.children:
                if not mod.type.endswith("annotation"):
                    mod_text = mod.text.decode("utf-8", errors="ignore")
                    if mod_text:
                        sig_parts.append(mod_text)
        kind_label = node.type.replace("_declaration", "")
        sig_parts.append(kind_label)
        sig_parts.append(class_name)
        signature = " ".join(sig_parts)

        entity = CodeEntity(
            name=class_name,
            kind="class",
            file_path=file_path,
            commit_hash=commit_hash,
            repository_id=repository_id,
            parent_id=parent_id,
            signature=signature,
        )
        return entity, base_route

    def _walk_class_body(
        self,
        body_node: Node,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str],
        entities: list[CodeEntity],
        parent_class_id: str,
        base_route: str,
    ) -> None:
        for child in body_node.children:
            if child.type in ("method_declaration", "constructor_declaration"):
                method_entity, endpoint_entity, param_entities = self._extract_method(
                    child,
                    file_path,
                    commit_hash,
                    repository_id,
                    parent_class_id,
                    base_route,
                )
                if method_entity:
                    entities.append(method_entity)
                    if endpoint_entity:
                        entities.append(endpoint_entity)
                    entities.extend(param_entities)
            elif child.type in ("class_declaration", "interface_declaration", "record_declaration"):
                # Nested class
                nested_entity, nested_route = self._extract_class(
                    child, file_path, commit_hash, repository_id, parent_class_id
                )
                if nested_entity:
                    entities.append(nested_entity)
                    nested_body = child.child_by_field_name("body")
                    if nested_body:
                        self._walk_class_body(
                            nested_body,
                            file_path,
                            commit_hash,
                            repository_id,
                            entities,
                            parent_class_id=nested_entity.id,
                            base_route=nested_route or base_route,
                        )

    def _extract_method(
        self,
        node: Node,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str],
        parent_class_id: str,
        base_route: str,
    ) -> tuple[Optional[CodeEntity], Optional[CodeEntity], list[CodeEntity]]:
        name_node = self._get_child_by_type(node, "identifier") or node.child_by_field_name("name")
        if not name_node or not name_node.text:
            return None, None, []

        method_name = name_node.text.decode("utf-8", errors="ignore")
        modifiers_node = self._get_child_by_type(node, "modifiers") or node.child_by_field_name("modifiers")
        annotations = self._extract_annotations(modifiers_node) if modifiers_node else []

        # Return type
        return_type = "void"
        ret_node = self._get_child_by_type(node, "type_identifier") or node.child_by_field_name("type")
        if not ret_node:
            for c in node.children:
                if c.type in ("generic_type", "integral_type", "floating_point_type", "boolean_type", "void_type"):
                    ret_node = c
                    break
        if ret_node and ret_node.text:
            return_type = ret_node.text.decode("utf-8", errors="ignore")

        # Parameters
        params_node = self._get_child_by_type(node, "formal_parameters") or node.child_by_field_name("parameters")
        param_list_strs = []
        param_entities: list[CodeEntity] = []

        method_entity = CodeEntity(
            name=method_name,
            kind="method",
            file_path=file_path,
            commit_hash=commit_hash,
            repository_id=repository_id,
            parent_id=parent_class_id,
        )

        if params_node:
            for param_child in params_node.children:
                if param_child.type in ("formal_parameter", "spread_parameter"):
                    p_name_node = param_child.child_by_field_name("name")
                    p_type_node = param_child.child_by_field_name("type")
                    if p_name_node and p_name_node.text:
                        p_name = p_name_node.text.decode("utf-8", errors="ignore")
                        p_type = p_type_node.text.decode("utf-8", errors="ignore") if p_type_node else "var"
                        param_sig = f"{p_type} {p_name}"
                        param_list_strs.append(param_sig)

                        param_entity = CodeEntity(
                            name=p_name,
                            kind="parameter",
                            file_path=file_path,
                            commit_hash=commit_hash,
                            repository_id=repository_id,
                            parent_id=method_entity.id,
                            signature=param_sig,
                        )
                        param_entities.append(param_entity)

        # Full method signature
        param_str = ", ".join(param_list_strs)
        method_entity.signature = f"{return_type} {method_name}({param_str})"

        # Check for Spring endpoint annotations
        endpoint_entity = self._extract_endpoint(
            annotations, base_route, method_entity, file_path, commit_hash, repository_id
        )

        return method_entity, endpoint_entity, param_entities

    def _extract_endpoint(
        self,
        annotations: list[tuple[str, Optional[str]]],
        base_route: str,
        method_entity: CodeEntity,
        file_path: str,
        commit_hash: str,
        repository_id: Optional[str],
    ) -> Optional[CodeEntity]:
        mapping_methods = {
            "GetMapping": "GET",
            "PostMapping": "POST",
            "PutMapping": "PUT",
            "DeleteMapping": "DELETE",
            "PatchMapping": "PATCH",
            "RequestMapping": "REQUEST",
        }

        for ann_name, ann_path in annotations:
            simple_ann = ann_name.split(".")[-1]
            if simple_ann in mapping_methods:
                http_verb = mapping_methods[simple_ann]
                sub_path = ann_path or ""
                # Combine base_route and sub_path
                full_path = self._join_routes(base_route, sub_path)
                endpoint_name = f"{http_verb} {full_path}"
                endpoint_sig = f"{http_verb} {full_path} -> {method_entity.signature}"

                return CodeEntity(
                    name=endpoint_name,
                    kind="endpoint",
                    file_path=file_path,
                    commit_hash=commit_hash,
                    repository_id=repository_id,
                    parent_id=method_entity.id,
                    signature=endpoint_sig,
                )

        return None

    def _extract_annotations(self, modifiers_node: Optional[Node]) -> list[tuple[str, Optional[str]]]:
        if not modifiers_node:
            return []
        annotations: list[tuple[str, Optional[str]]] = []
        for child in modifiers_node.children:
            if child.type in ("annotation", "marker_annotation"):
                ann_text = child.text.decode("utf-8", errors="ignore")
                # e.g. @GetMapping("/orders") or @RestController
                match = re.match(r"^@([\w.]+)(?:\((.*)\))?$", ann_text.strip(), re.DOTALL)
                if match:
                    ann_name = match.group(1)
                    raw_args = match.group(2)
                    path_val = None
                    if raw_args:
                        # Extract first quoted string or value = "..."
                        str_match = re.search(r'["\']([^"\']*)["\']', raw_args)
                        if str_match:
                            path_val = str_match.group(1)
                    annotations.append((ann_name, path_val))
        return annotations

    @staticmethod
    def _join_routes(base: str, sub: str) -> str:
        b = base.strip().strip("/")
        s = sub.strip().strip("/")
        if b and s:
            return f"/{b}/{s}"
        elif b:
            return f"/{b}"
        elif s:
            return f"/{s}"
        return "/"
