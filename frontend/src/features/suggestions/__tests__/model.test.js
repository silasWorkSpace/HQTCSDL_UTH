import { describe, expect, it } from 'vitest'
import { maxSeverity, severityRank } from '../../../constants/severity'
import { formatDateTime, shortId, slug } from '../../shared/format'
import { problemMessage } from '../../shared/problemMessage'
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
} from '../model'

const EVIDENCE = JSON.stringify({
  entities: [
    { entity: 'UserService.save', kind: 'method', severity: 'High', sections: ['Mô tả'], message: 'đổi chữ ký', old: 'save(a)', new: 'save(a, b)' },
    { entity: 'UserController.get', kind: 'endpoint', severity: 'Critical', message: 'xóa' },
  ],
})

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
}

describe('severity', () => {
  it('xếp hạng bốn mức và lấy mức cao nhất', () => {
    expect(severityRank('Low')).toBe(0)
    expect(severityRank('Critical')).toBe(3)
    expect(severityRank('x')).toBe(-1)
    expect(maxSeverity(['Low', 'High', 'Medium'])).toBe('High')
    expect(maxSeverity([])).toBeNull()
    expect(maxSeverity(['bậy'])).toBeNull()
  })
})

describe('format', () => {
  it('slug, shortId và ngày giờ', () => {
    expect(slug('Pending Developer Action')).toBe('pending_developer_action')
    expect(shortId('12345678-aaaa')).toBe('12345678')
    expect(shortId(null)).toBe('')
    expect(formatDateTime('2026-11-07T10:00:00Z', 'vi').length > 0).toBe(true)
    expect(formatDateTime('không phải ngày')).toBe('')
    expect(formatDateTime(null)).toBe('')
  })
})

describe('problemMessage', () => {
  const t = (key) => key
  it('ghép detail với cách khắc phục theo mã lỗi', () => {
    const err = { response: { status: 409, data: { detail: 'Gợi ý đã xử lý' } } }
    expect(problemMessage(err, t)).toBe('Gợi ý đã xử lý workflow.errors.hint409')
  })
  it('không có response là lỗi mạng', () => {
    expect(problemMessage(new Error('x'), t)).toBe('workflow.errors.network')
  })
  it('không có detail dùng thông báo chung', () => {
    expect(problemMessage({ response: { status: 500, data: {} } }, t)).toBe(
      'workflow.errors.generic workflow.errors.hintDefault',
    )
  })
})

describe('evidence', () => {
  it('đọc chuỗi JSON hoặc object, sai định dạng thì rỗng', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 })
    expect(parseJson({ a: 1 })).toEqual({ a: 1 })
    expect(parseJson('không phải json')).toBeNull()
    expect(parseJson('')).toBeNull()
    expect(normalizeEvidence('hỏng').entities).toHaveLength(0)
    expect(hasEvidence(normalizeEvidence(null))).toBe(false)
  })
  it('chuẩn hóa thực thể và các trường commit, file, ticket', () => {
    const ev = normalizeEvidence({ ...JSON.parse(EVIDENCE), commit_hash: 'abc123', filePath: 'A.java', ticket: 'LD-1' })
    expect(ev.entities[0]).toEqual({
      entity: 'UserService.save', kind: 'method', severity: 'High', sections: ['Mô tả'],
      message: 'đổi chữ ký', oldSignature: 'save(a)', newSignature: 'save(a, b)',
    })
    expect(ev.entities[1].sections).toEqual([])
    expect([ev.commit, ev.file, ev.ticket]).toEqual(['abc123', 'A.java', 'LD-1'])
    expect(hasEvidence(ev)).toBe(true)
  })
})

describe('suggestion', () => {
  it('chuẩn hóa bản ghi snake_case của backend', () => {
    const s = normalizeSuggestion(RAW_SUGGESTION)
    expect(s.documentId).toBe('d1')
    expect(s.documentTitle).toBe('API Người dùng')
    expect(s.driftAlertId).toBe('a1')
    expect(s.confidence).toBe(0.9)
    expect(confidencePercent(s.confidence)).toBe(90)
    expect(s.topSeverity).toBe('Critical')
    expect(s.createdAt).toBe('2026-11-07T10:00:00.000+00:00')
    expect(isPending(s)).toBe(true)
  })
  it('chấp nhận camelCase và giữ điểm tin cậy trong khoảng 0 đến 1', () => {
    const s = normalizeSuggestion({ id: 's2', documentId: 'd2', confidenceScore: 7, status: 'Accepted' })
    expect(s.documentId).toBe('d2')
    expect(s.confidence).toBe(1)
    expect(isPending(s)).toBe(false)
    expect(normalizeSuggestion({ id: 's3', confidence_score: 'x' }).confidence).toBeNull()
    expect(confidencePercent(null)).toBeNull()
  })
  it('sắp xếp theo mức nghiêm trọng rồi theo thời gian mới nhất', () => {
    const low = normalizeSuggestion({ id: 'a', created_at: '2026-11-09', evidence: { entities: [{ severity: 'Low' }] } })
    const crit = normalizeSuggestion({ id: 'b', created_at: '2026-11-01', evidence: { entities: [{ severity: 'Critical' }] } })
    const lowNew = normalizeSuggestion({ id: 'c', created_at: '2026-11-10', evidence: { entities: [{ severity: 'Low' }] } })
    expect(sortSuggestions([low, crit, lowNew]).map((s) => s.id)).toEqual(['b', 'c', 'a'])
  })
  it('liệt kê tài liệu duy nhất theo tên', () => {
    const list = ['d2', 'd1', 'd2'].map((id, i) => normalizeSuggestion({ id: `s${i}`, document_id: id, document_title: id === 'd1' ? 'B' : 'A' }))
    expect(uniqueDocuments(list)).toEqual([{ id: 'd2', title: 'A' }, { id: 'd1', title: 'B' }])
  })
})

describe('drift alert', () => {
  const alerts = [
    normalizeDriftAlert({ id: '1', drift_type: 'Signature', severity: 'High', handling_status: 'Open', evidence: EVIDENCE, source_event_id: 'e1', document_id: 'd1', created_at: 'x' }),
    normalizeDriftAlert({ id: '2', driftType: 'Referential', severity: 'Low', handlingStatus: 'Resolved' }),
  ]
  it('chuẩn hóa hai dạng tên trường', () => {
    expect(alerts[0].driftType).toBe('Signature')
    expect(alerts[0].sourceEventId).toBe('e1')
    expect(alerts[0].evidence.entities).toHaveLength(2)
    expect(alerts[1].handlingStatus).toBe('Resolved')
  })
  it('lọc theo mức và trạng thái', () => {
    expect(filterAlerts(alerts, {})).toHaveLength(2)
    expect(filterAlerts(alerts, { severity: 'High' }).map((a) => a.id)).toEqual(['1'])
    expect(filterAlerts(alerts, { handlingStatus: 'Resolved' }).map((a) => a.id)).toEqual(['2'])
    expect(filterAlerts(alerts, { severity: 'High', handlingStatus: 'Resolved' })).toHaveLength(0)
  })
})

describe('dismiss', () => {
  const labelOf = (code) => `L:${code}`
  it('lý do có sẵn gửi đi ngay', () => {
    expect(buildDismissReason({ code: 'duplicate' }, labelOf)).toBe('L:duplicate')
  })
  it('lý do Khác bắt buộc có ghi chú đủ dài', () => {
    expect(buildDismissReason({ code: 'other', note: '  ' }, labelOf)).toBeNull()
    expect(buildDismissReason({ code: 'other', note: 'ab' }, labelOf)).toBeNull()
    expect(buildDismissReason({ code: 'other', note: ' tài liệu sắp bỏ ' }, labelOf)).toBe('L:other: tài liệu sắp bỏ')
  })
  it('chưa chọn lý do thì không hợp lệ', () => {
    expect(buildDismissReason({ code: null }, labelOf)).toBeNull()
  })
})

describe('published content', () => {
  it('chỉ lấy bản Published, không dùng bản nháp', () => {
    expect(extractPublishedContent({ publishedContent: 'A' })).toBe('A')
    expect(extractPublishedContent({ publishedVersion: { content: 'B' } })).toBe('B')
    expect(extractPublishedContent({ currentVersion: { content: 'nháp' } })).toBeNull()
    expect(extractPublishedContent(null)).toBeNull()
  })
})
