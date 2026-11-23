import json
from app.rag.chunker import chunk_source_file, chunk_document, compute_checksum


def test_chunk_source_file_with_entities():
    code = (
        "public class UserService {\n"
        "    // API_KEY=AIzaSySecret1234567890\n"
        "    public User getUser(String id) {\n"
        "        return null;\n"
        "    }\n"
        "}\n"
    )
    entities = [
        {"id": "ent-1", "name": "UserService", "file_path": "UserService.java", "line_start": 1, "line_end": 6},
        {"id": "ent-2", "name": "getUser", "file_path": "UserService.java", "line_start": 3, "line_end": 5},
    ]

    chunks = chunk_source_file("UserService.java", code, "a" * 40, "repo-1", entities)
    assert len(chunks) >= 2
    for c in chunks:
        assert c["commit_sha"] == "a" * 40
        assert c["repository_id"] == "repo-1"
        assert c["chunk_type"] == "CODE"
        assert "[REDACTED]" in c["content"] or "AIzaSy" not in c["content"]
        assert len(c["checksum"]) == 64


def test_chunk_document_by_headings():
    doc = (
        "# User Service\n\nOverview of user service.\n\n"
        "## Endpoints\n\nGET /users\n\n"
        "### Authentication\n\nBearer token required."
    )
    chunks = chunk_document("doc-1", 1, doc, "ver-1")
    assert len(chunks) == 3
    assert chunks[0]["chunk_type"] == "DOCUMENT"
    assert chunks[0]["document_id"] == "doc-1"
    assert chunks[0]["document_version_id"] == "ver-1"
    assert "User Service" in chunks[0]["content"]
    assert "Endpoints" in chunks[1]["content"]
    assert "Authentication" in chunks[2]["content"]
