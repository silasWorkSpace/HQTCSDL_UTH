import { describe, expect, it } from 'vitest'
import {
  buildDecisionPayload,
  decisionBlock,
  decisionOptions,
  normalizeReviewDetail,
  personLabel,
  queueLevelsFor,
  reasonRequired,
  validateDecision,
} from '../model'

const task = (over = {}) => ({ id: 't1', status: 'Pending', level: 'Staff', submitterId: 'dev', ...over })

describe('hàng đợi theo vai trò', () => {
  it('mỗi vai trò chỉ thấy cấp của mình, Administrator thấy cả hai', () => {
    expect(queueLevelsFor(['Staff'])).toEqual(['staff'])
    expect(queueLevelsFor(['Manager'])).toEqual(['manager'])
    expect(queueLevelsFor(['Staff', 'Manager'])).toEqual(['staff', 'manager'])
    expect(queueLevelsFor(['Administrator'])).toEqual(['staff', 'manager'])
    expect(queueLevelsFor(['Developer'])).toEqual([])
    expect(queueLevelsFor()).toEqual([])
  })
})

describe('quyết định', () => {
  it('Staff duyệt hoặc từ chối, Manager thêm trả lại', () => {
    expect(decisionOptions('Staff')).toEqual(['APPROVE', 'REJECT'])
    expect(decisionOptions('staff')).toEqual(['APPROVE', 'REJECT'])
    expect(decisionOptions('Manager')).toEqual(['APPROVE', 'REJECT', 'RETURN'])
  })
  it('từ chối và trả lại bắt buộc có lý do', () => {
    expect(reasonRequired('REJECT')).toBe(true)
    expect(reasonRequired('RETURN')).toBe(true)
    expect(reasonRequired('APPROVE')).toBe(false)
    expect(validateDecision({ decision: 'REJECT', reason: '  ', level: 'Staff' })).toEqual({ valid: false, error: 'reasonRequired' })
    expect(validateDecision({ decision: 'REJECT', reason: 'sai mô tả', level: 'Staff' }).valid).toBe(true)
    expect(validateDecision({ decision: 'APPROVE', level: 'Staff' }).valid).toBe(true)
  })
  it('chặn quyết định không thuộc cấp và chưa chọn', () => {
    expect(validateDecision({ decision: 'RETURN', reason: 'x', level: 'Staff' })).toEqual({ valid: false, error: 'notAllowed' })
    expect(validateDecision({ level: 'Staff' })).toEqual({ valid: false, error: 'decisionRequired' })
  })
  it('dựng body: bỏ comment rỗng, số dòng sai thành null', () => {
    const body = buildDecisionPayload({
      decision: 'REJECT',
      reason: '  thiếu ví dụ ',
      comments: [{ content: ' mục 2 sai ', lineNumber: '12' }, { content: '   ' }, { content: 'chung', lineNumber: 'abc' }],
    })
    expect(body).toEqual({
      decision: 'REJECT',
      reason: 'thiếu ví dụ',
      comments: [{ content: 'mục 2 sai', lineNumber: 12 }, { content: 'chung', lineNumber: null }],
    })
    expect(buildDecisionPayload({ decision: 'APPROVE' })).toEqual({ decision: 'APPROVE', reason: null, comments: [] })
  })
})

describe('tách biệt nhiệm vụ (WF-22) và quyền', () => {
  const staff = { id: 'u1', roles: ['Staff'] }
  it('cho phép Staff duyệt task cấp Staff của người khác', () => {
    expect(decisionBlock({ task: task(), user: staff })).toBeNull()
  })
  it('khóa khi người dùng là người nộp', () => {
    expect(decisionBlock({ task: task({ submitterId: 'u1' }), user: staff })).toBe('self')
  })
  it('khóa khi task đã xử lý, ưu tiên hơn các lý do khác', () => {
    expect(decisionBlock({ task: task({ status: 'Approved', submitterId: 'u1' }), user: staff })).toBe('closed')
  })
  it('khóa khi sai vai trò hoặc chưa có thông tin', () => {
    expect(decisionBlock({ task: task({ level: 'Manager' }), user: staff })).toBe('role')
    expect(decisionBlock({ task: task(), user: { id: 'u2', roles: ['Developer'] } })).toBe('role')
    expect(decisionBlock({ task: null, user: staff })).toBe('role')
    expect(decisionBlock({ task: task(), user: null })).toBe('role')
  })
  it('Administrator duyệt được cả hai cấp', () => {
    expect(decisionBlock({ task: task({ level: 'Manager' }), user: { id: 'a', roles: ['Administrator'] } })).toBeNull()
  })
})

describe('chi tiết duyệt', () => {
  it('chuẩn hóa phản hồi của GET /reviews/{id}', () => {
    const detail = normalizeReviewDetail({
      task: { id: 't1', level: 'Manager', status: 'Pending', submitterId: 'dev' },
      document: { id: 'd1', title: 'Tài liệu' },
      versionUnderReview: { versionNo: 3, content: 'mới' },
      changeLog: [{ versionNo: 3 }, { versionNo: 1 }, { versionNo: 2 }],
      lastApprovedVersion: { versionNo: 1, content: 'cũ' },
      decisions: [{ reviewerId: 'r1', reviewerName: 'Lan', decision: 'APPROVE', reason: null, decidedAt: 'x' }],
      comments: [{ userId: 'r1', content: 'sai mục 2', lineNumber: 4 }],
    })
    expect(detail.task.level).toBe('Manager')
    expect(detail.version.content).toBe('mới')
    expect(detail.changeLog.map((v) => v.versionNo)).toEqual([1, 2, 3])
    expect(detail.lastApproved.content).toBe('cũ')
    expect(detail.decisions[0].reviewerName).toBe('Lan')
    expect(detail.comments[0]).toEqual({ userId: 'r1', userName: null, content: 'sai mục 2', lineNumber: 4, createdAt: null })
  })
  it('thiếu trường thì dùng giá trị rỗng, không lỗi', () => {
    const detail = normalizeReviewDetail({ task: { id: 't' } })
    expect(detail.version).toBeNull()
    expect(detail.lastApproved).toBeNull()
    expect(detail.changeLog).toEqual([])
    expect(detail.decisions).toEqual([])
    expect(detail.comments).toEqual([])
    expect(normalizeReviewDetail(null).task).toBeNull()
  })
  it('tên người duyệt rơi về 8 ký tự đầu của id', () => {
    expect(personLabel('Lan', 'abcdef1234')).toBe('Lan')
    expect(personLabel(null, 'abcdef1234')).toBe('abcdef12')
  })
})
