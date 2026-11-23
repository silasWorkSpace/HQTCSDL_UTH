import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { maxSeverity, severityRank } from '../src/constants/severity.js';
import { formatDateTime, shortId, slug } from '../src/features/shared/format.js';
import { problemMessage } from '../src/features/shared/problemMessage.js';
import {
  buildDismissReason,
  confidencePercent,
  extractPublishedContent,
  filterAlerts,
  hasEvidence,
  isPending,
  normalizeDriftAlert,
  normalizeEvidence,
  normalizeSuggestion,
  parseJson,
  sortSuggestions,
  uniqueDocuments,
} from '../src/features/suggestions/model.js';

const EVIDENCE = JSON.stringify({
  entities: [
    { entity: 'UserService.save', kind: 'method', severity: 'High', sections: ['Mô tả'], message: 'đổi chữ ký', old: 'save(a)', new: 'save(a, b)' },
    { entity: 'UserController.get', kind: 'endpoint', severity: 'Critical', message: 'xóa' },
  ],
});

const RAW_SUGGESTION = {
  id: 's1',
  document_id: 'd1',
  document_title: 'API Người dùng',
  drift_alert_id: 'a1',
  origin: 'drift',
  content: 'nội dung mới',
  confidence_score: 0.9,
  evidence: EVIDENCE,
  status: 'Pending Developer Action',
  dismiss_reason: null,
  created_at: '2026-11-07T10:00:00.000+00:00',
};

describe('Severity (DR-03)', () => {
  it('xếp hạng bốn mức và lấy mức cao nhất', () => {
    assert.equal(severityRank('Low'), 0);
    assert.equal(severityRank('Critical'), 3);
    assert.equal(severityRank('x'), -1);
    assert.equal(maxSeverity(['Low', 'High', 'Medium']), 'High');
    assert.equal(maxSeverity([]), null);
    assert.equal(maxSeverity(['bậy']), null);
  });
});

describe('Format helpers', () => {
  it('slug, shortId và ngày giờ', () => {
    assert.equal(slug('Pending Developer Action'), 'pending_developer_action');
    assert.equal(shortId('12345678-aaaa'), '12345678');
    assert.equal(shortId(null), '');
    assert.equal(formatDateTime('2026-11-07T10:00:00Z', 'vi').length > 0, true);
    assert.equal(formatDateTime('không phải ngày'), '');
    assert.equal(formatDateTime(null), '');
  });
});

describe('Problem Message (RFC 7807)', () => {
  const t = (key) => key;
  it('ghép detail với cách khắc phục theo mã lỗi', () => {
    const err = { response: { status: 409, data: { detail: 'Gợi ý đã xử lý' } } };
    assert.equal(problemMessage(err, t), 'Gợi ý đã xử lý workflow.errors.hint409');
  });
  it('không có response là lỗi mạng', () => {
    assert.equal(problemMessage(new Error('x'), t), 'workflow.errors.network');
  });
  it('không có detail dùng thông báo chung', () => {
    assert.equal(
      problemMessage({ response: { status: 500, data: {} } }, t),
      'workflow.errors.generic workflow.errors.hintDefault'
    );
  });
});

describe('Evidence parsing (DR-07)', () => {
  it('đọc chuỗi JSON hoặc object, sai định dạng thì rỗng', () => {
    assert.deepEqual(parseJson('{"a":1}'), { a: 1 });
    assert.deepEqual(parseJson({ a: 1 }), { a: 1 });
    assert.equal(parseJson('không phải json'), null);
    assert.equal(parseJson(''), null);
    assert.equal(normalizeEvidence('hỏng').entities.length, 0);
    assert.equal(hasEvidence(normalizeEvidence(null)), false);
  });

  it('chuẩn hóa thực thể và các trường commit, file, ticket', () => {
    const ev = normalizeEvidence({ ...JSON.parse(EVIDENCE), commit_hash: 'abc123', filePath: 'A.java', ticket: 'LD-1' });
    assert.deepEqual(ev.entities[0], {
      entity: 'UserService.save', kind: 'method', severity: 'High', sections: ['Mô tả'],
      message: 'đổi chữ ký', oldSignature: 'save(a)', newSignature: 'save(a, b)',
    });
    assert.deepEqual(ev.entities[1].sections, []);
    assert.deepEqual([ev.commit, ev.file, ev.ticket], ['abc123', 'A.java', 'LD-1']);
    assert.equal(hasEvidence(ev), true);
  });
});

describe('Suggestion normalization (AUTO-02/07)', () => {
  it('chuẩn hóa bản ghi snake_case của backend', () => {
    const s = normalizeSuggestion(RAW_SUGGESTION);
    assert.equal(s.documentId, 'd1');
    assert.equal(s.documentTitle, 'API Người dùng');
    assert.equal(s.driftAlertId, 'a1');
    assert.equal(s.confidence, 0.9);
    assert.equal(confidencePercent(s.confidence), 90);
    assert.equal(s.topSeverity, 'Critical');
    assert.equal(s.createdAt, '2026-11-07T10:00:00.000+00:00');
    assert.equal(isPending(s), true);
  });

  it('chấp nhận camelCase và giữ điểm tin cậy trong khoảng 0 đến 1', () => {
    const s = normalizeSuggestion({ id: 's2', documentId: 'd2', confidenceScore: 7, status: 'Accepted' });
    assert.equal(s.documentId, 'd2');
    assert.equal(s.confidence, 1);
    assert.equal(isPending(s), false);
    assert.equal(normalizeSuggestion({ id: 's3', confidence_score: 'x' }).confidence, null);
    assert.equal(confidencePercent(null), null);
  });

  it('sắp xếp theo mức nghiêm trọng rồi theo thời gian mới nhất', () => {
    const low = normalizeSuggestion({ id: 'a', created_at: '2026-11-09', evidence: { entities: [{ severity: 'Low' }] } });
    const crit = normalizeSuggestion({ id: 'b', created_at: '2026-11-01', evidence: { entities: [{ severity: 'Critical' }] } });
    const lowNew = normalizeSuggestion({ id: 'c', created_at: '2026-11-10', evidence: { entities: [{ severity: 'Low' }] } });
    assert.deepEqual(sortSuggestions([low, crit, lowNew]).map((s) => s.id), ['b', 'c', 'a']);
  });

  it('liệt kê tài liệu duy nhất theo tên', () => {
    const list = ['d2', 'd1', 'd2'].map((id, i) => normalizeSuggestion({ id: `s${i}`, document_id: id, document_title: id === 'd1' ? 'B' : 'A' }));
    assert.deepEqual(uniqueDocuments(list), [{ id: 'd2', title: 'A' }, { id: 'd1', title: 'B' }]);
  });
});

describe('Drift alert normalization (DR-12)', () => {
  const alerts = [
    normalizeDriftAlert({ id: '1', drift_type: 'Signature', severity: 'High', handling_status: 'Open', evidence: EVIDENCE, source_event_id: 'e1', document_id: 'd1', created_at: 'x' }),
    normalizeDriftAlert({ id: '2', driftType: 'Referential', severity: 'Low', handlingStatus: 'Resolved' }),
  ];

  it('chuẩn hóa hai dạng tên trường', () => {
    assert.equal(alerts[0].driftType, 'Signature');
    assert.equal(alerts[0].sourceEventId, 'e1');
    assert.equal(alerts[0].evidence.entities.length, 2);
    assert.equal(alerts[1].handlingStatus, 'Resolved');
  });

  it('lọc theo mức và trạng thái', () => {
    assert.equal(filterAlerts(alerts, {}).length, 2);
    assert.deepEqual(filterAlerts(alerts, { severity: 'High' }).map((a) => a.id), ['1']);
    assert.deepEqual(filterAlerts(alerts, { handlingStatus: 'Resolved' }).map((a) => a.id), ['2']);
    assert.equal(filterAlerts(alerts, { severity: 'High', handlingStatus: 'Resolved' }).length, 0);
  });
});
