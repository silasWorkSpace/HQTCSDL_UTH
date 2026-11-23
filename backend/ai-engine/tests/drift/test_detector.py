import random

from app.drift import (
    CodeEntity, DocLink, DriftType, EntityKind, MockSemanticProvider, Severity,
    build_drift_found_events, detect,
)

C = "com.acme.UserController"


def ep(name="getUser", route="/api/v1/users/{id}", params=(("id", "UUID"),), ret="UserDto", **kw):
    return CodeEntity(f"{C}.{name}", EntityKind.ENDPOINT, "UserController.java", params, ret,
                      C, True, "GET", route, **kw)


def meth(name="helper", params=(), ret=None, public=True, **kw):
    return CodeEntity(f"{C}.{name}", EntityKind.METHOD, "UserController.java", params, ret,
                      C, public, **kw)


def cls(name, path):
    return CodeEntity(f"com.acme.{name}", EntityKind.CLASS, path, parent="com.acme")


def link(q, doc="d1", section=None):
    return DocLink(doc, q, section)


def test_no_change_no_findings():
    e = [ep(), meth()]
    assert detect(e, e, [link(e[0].qualified_name)]) == []


def test_deleted_public_endpoint_is_critical():
    old = [ep()]
    f = detect(old, [], [link(old[0].qualified_name)])
    assert len(f) == 1
    assert f[0].drift_type is DriftType.REFERENTIAL and f[0].severity is Severity.CRITICAL
    assert f[0].suggestion.confidence == 0.70


def test_deleted_method_is_high_and_private_is_lowered():
    pub, priv = meth("a"), meth("b", public=False)
    f = detect([pub, priv], [], [link(pub.qualified_name), link(priv.qualified_name)])
    sev = {x.entity.rsplit(".", 1)[-1]: x.severity for x in f}
    assert sev == {"a": Severity.HIGH, "b": Severity.MEDIUM}


def test_unique_rename_detected_as_medium():
    old = meth("calcTotal", (("a", "int"),), "int")
    new = meth("computeTotal", (("a", "int"),), "int")
    f = detect([old], [new], [link(old.qualified_name)])
    assert len(f) == 1 and f[0].severity is Severity.MEDIUM
    assert "computeTotal" in f[0].message and f[0].suggestion.confidence == 0.90
    assert "computeTotal" in f[0].evidence["new"]


def test_ambiguous_rename_falls_back_to_deleted():
    old = meth("run")
    f = detect([old], [meth("start"), meth("stop")], [link(old.qualified_name)])
    assert "đã bị xóa" in f[0].message and f[0].severity is Severity.HIGH


def test_two_removed_one_candidate_is_not_rename():
    a, b = meth("a"), meth("b")
    f = detect([a, b], [meth("c")], [link(a.qualified_name), link(b.qualified_name)])
    assert all("đã bị xóa" in x.message for x in f)


def test_class_rename_requires_same_file():
    old = cls("Old", "Old.java")
    same_file = cls("New", "Old.java")
    other_file = cls("New", "Other.java")
    assert "đổi tên" in detect([old], [same_file], [link(old.qualified_name)])[0].message
    assert "đã bị xóa" in detect([old], [other_file], [link(old.qualified_name)])[0].message


def test_signature_param_type_change_is_high():
    old, new = meth("save", (("id", "int"),)), meth("save", (("id", "long"),))
    f = detect([old], [new], [link(old.qualified_name)])
    assert f[0].drift_type is DriftType.SIGNATURE and f[0].severity is Severity.HIGH
    assert "`id` đổi từ int sang long" in f[0].message
    assert f[0].suggestion.confidence == 0.90


def test_param_added_removed_reordered_and_return_change():
    old = meth("m", (("a", "int"), ("b", "str")), "int")
    added = meth("m", (("a", "int"), ("b", "str"), ("c", "int")), "int")
    removed = meth("m", (("a", "int"),), "int")
    reordered = meth("m", (("b", "str"), ("a", "int")), "int")
    ret = meth("m", (("a", "int"), ("b", "str")), "long")
    q = old.qualified_name
    msg = lambda n: detect([old], [n], [link(q)])[0].message
    assert "thêm tham số `c`" in msg(added)
    assert "bỏ tham số `b`" in msg(removed)
    assert "đổi thứ tự tham số" in msg(reordered)
    assert "kiểu trả về đổi từ int sang long" in msg(ret)


def test_endpoint_route_change_is_critical():
    old, new = ep(), ep(route="/api/v2/users/{id}")
    f = detect([old], [new], [link(old.qualified_name)])
    assert f[0].severity is Severity.CRITICAL and "đường dẫn" in f[0].message


def test_private_signature_change_is_medium():
    old, new = meth("x", public=False), meth("x", (("a", "int"),), public=False)
    assert detect([old], [new], [link(old.qualified_name)])[0].severity is Severity.MEDIUM


def test_file_move_alone_is_not_drift():
    old = meth("x")
    moved = CodeEntity(old.qualified_name, old.kind, "Other.java", old.params, old.return_type, old.parent)
    assert detect([old], [moved], [link(old.qualified_name)]) == []


def test_links_grouped_per_doc_and_entity_with_sections():
    e = meth("x")
    links = [link(e.qualified_name, "d1", "Mô tả"), link(e.qualified_name, "d1", "Ví dụ"),
             link(e.qualified_name, "d2", "Mô tả")]
    f = detect([e], [], links)
    assert len(f) == 2
    d1 = next(x for x in f if x.doc_id == "d1")
    assert d1.sections == ("Mô tả", "Ví dụ")


def test_link_to_entity_unknown_before_is_skipped():
    assert detect([], [], [link("com.acme.Ghost.x")]) == []


def test_semantic_only_with_provider_and_when_signature_same():
    old, new = meth("x", body_hash="aaa"), meth("x", body_hash="bbb")
    q = old.qualified_name
    assert detect([old], [new], [link(q)]) == []
    f = detect([old], [new], [link(q)], semantic=MockSemanticProvider())
    assert f[0].drift_type is DriftType.SEMANTIC and f[0].severity is Severity.LOW
    assert f[0].suggestion.confidence == 0.40
    e_old, e_new = ep(body_hash="a"), ep(body_hash="b")
    f2 = detect([e_old], [e_new], [link(e_old.qualified_name)], semantic=MockSemanticProvider())
    assert f2[0].severity is Severity.MEDIUM


def test_semantic_skipped_when_signature_drift_present():
    old = meth("x", body_hash="a")
    new = meth("x", (("p", "int"),), body_hash="b")
    f = detect([old], [new], [link(old.qualified_name)], semantic=MockSemanticProvider())
    assert [x.drift_type for x in f] == [DriftType.SIGNATURE]


def test_deterministic_ids_and_order_independent_of_input_order():
    old = [ep(), meth("a"), meth("b", (("x", "int"),)), meth("c")]
    new = [ep(route="/api/v2/users/{id}"), meth("b", (("x", "long"),))]
    links = [link(e.qualified_name) for e in old]
    first = detect(old, new, links)
    for _ in range(5):
        o, n, l = old[:], new[:], links[:]
        random.shuffle(o); random.shuffle(n); random.shuffle(l)
        again = detect(o, n, l)
        assert again == first
        assert [f.finding_id for f in again] == [f.finding_id for f in first]


def test_sorted_by_severity_desc():
    old = [ep(), meth("a"), meth("b", public=False)]
    f = detect(old, [], [link(e.qualified_name) for e in old])
    ranks = [x.severity.rank for x in f]
    assert ranks == sorted(ranks, reverse=True)


def test_different_change_gives_different_id():
    old = meth("x", (("a", "int"),))
    q = old.qualified_name
    f1 = detect([old], [meth("x", (("a", "long"),))], [link(q)])[0]
    f2 = detect([old], [meth("x", (("a", "str"),))], [link(q)])[0]
    assert f1.finding_id != f2.finding_id


def test_accepts_plain_dicts_from_json():
    old = [{"qualifiedName": "a.B.m", "kind": "method", "params": [{"name": "x", "type": "int"}],
            "returnType": "int", "parent": "a.B"}]
    new = [{"qualified_name": "a.B.m", "kind": "method", "params": [["x", "long"]],
            "return_type": "int", "parent": "a.B"}]
    f = detect(old, new, [{"docId": "d1", "entityQualifiedName": "a.B.m", "section": "S"}])
    assert f[0].drift_type is DriftType.SIGNATURE and f[0].sections == ("S",)


DOC1 = "11111111-1111-1111-1111-111111111111"
DOC2 = "22222222-2222-2222-2222-222222222222"
SRC = "99999999-9999-9999-9999-999999999999"


def _events(old, new, links, corr="not-a-uuid", **kw):
    f = detect(old, new, links)
    return f, build_drift_found_events(f, tenant="acme", correlation_id=corr,
                                       source_event_id=SRC,
                                       occurred_at="2026-11-07T00:00:00Z", **kw)


def test_event_matches_java_consumer_contract():
    import uuid
    old = [ep()]
    _, evs = _events(old, [], [link(old[0].qualified_name, DOC1, "Mô tả")])
    assert len(evs) == 1
    ev = evs[0]
    assert set(ev) == {"eventId", "type", "tenant", "correlationId", "occurredAt", "payload"}
    uuid.UUID(ev["eventId"]); uuid.UUID(ev["correlationId"])  # Java dùng UUID.fromString
    assert ev["type"] == "DRIFT_FOUND" and ev["tenant"] == "acme"
    p = ev["payload"]
    assert p["documentId"] == DOC1 and p["sourceEventId"] == SRC
    fd = p["findings"][0]
    assert fd["driftType"] == "Referential" and fd["severity"] == "Critical"
    assert set(fd["suggestion"]) == {"content", "confidence"}
    assert fd["suggestion"]["confidence"] == 0.70
    assert fd["evidence"]["entities"][0]["sections"] == ["Mô tả"]


def test_one_event_per_document():
    old = [ep(), meth("a")]
    links = [link(old[0].qualified_name, DOC1), link(old[1].qualified_name, DOC2)]
    _, evs = _events(old, [], links)
    assert [e["payload"]["documentId"] for e in evs] == [DOC1, DOC2]


def test_same_type_findings_merged_into_one_alert_with_max_severity():
    old = [ep(), meth("a"), meth("b", public=False)]
    links = [link(e.qualified_name, DOC1) for e in old]
    _, evs = _events(old, [], links)
    findings = evs[0]["payload"]["findings"]
    assert len(findings) == 1  # drift_alert unique theo (source_event, document, type)
    assert findings[0]["severity"] == "Critical"
    assert len(findings[0]["evidence"]["entities"]) == 3


def test_single_combined_suggestion_per_document_with_min_confidence():
    old = [meth("a"), meth("b", (("x", "int"),))]
    new = [meth("b", (("x", "long"),))]
    links = [link(e.qualified_name, DOC1) for e in old]
    _, evs = _events(old, new, links)
    findings = evs[0]["payload"]["findings"]
    assert {f["driftType"] for f in findings} == {"Referential", "Signature"}
    with_sug = [f for f in findings if "suggestion" in f]
    assert len(with_sug) == 1  # sp_supersede_stale_suggestions chỉ giữ bản mới nhất
    s = with_sug[0]["suggestion"]
    assert s["content"].startswith("1. ") and "\n2. " in s["content"]
    assert s["confidence"] == 0.70  # min(0.90, 0.70)
    assert "suggestion" in findings[0]  # gắn vào finding nghiêm trọng nhất


def test_event_ids_deterministic_and_empty_findings_no_event():
    old = [ep()]
    links = [link(old[0].qualified_name, DOC1)]
    _, a = _events(old, [], links)
    _, b = _events(old, [], links)
    assert a == b
    assert build_drift_found_events([], tenant="acme", correlation_id="c", source_event_id=SRC) == []


def test_uuid_correlation_id_kept_as_is():
    old = [ep()]
    cid = "33333333-3333-3333-3333-333333333333"
    _, evs = _events(old, [], [link(old[0].qualified_name, DOC1)], corr=cid)
    assert evs[0]["correlationId"] == cid
