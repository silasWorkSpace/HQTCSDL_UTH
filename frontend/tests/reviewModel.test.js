import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDecisionPayload,
  decisionBlock,
  decisionOptions,
  normalizeReviewDetail,
  personLabel,
  queueLevelsFor,
  reasonRequired,
  validateDecision,
} from '../src/features/reviews/model.js';

const task = (over = {}) => ({ id: 't1', status: 'Pending', level: 'Staff', submitterId: 'dev', ...over });

describe('Hàng đợi theo vai trò (WF-12)', () => {
  it('mỗi vai trò chỉ thấy cấp của mình, Administrator thấy cả hai', () => {
    assert.deepEqual(queueLevelsFor(['Staff']), ['staff']);
    assert.deepEqual(queueLevelsFor(['Manager']), ['manager']);
    assert.deepEqual(queueLevelsFor(['Staff', 'Manager']), ['staff', 'manager']);
    assert.deepEqual(queueLevelsFor(['Administrator']), ['staff', 'manager']);
    assert.deepEqual(queueLevelsFor(['Developer']), []);
    assert.deepEqual(queueLevelsFor(), []);
  });
});

describe('Quyết định duyệt (WF-09, 10, 14, 15)', () => {
  it('Staff duyệt hoặc từ chối, Manager thêm trả lại', () => {
    assert.deepEqual(decisionOptions('Staff'), ['APPROVE', 'REJECT']);
    assert.deepEqual(decisionOptions('staff'), ['APPROVE', 'REJECT']);
    assert.deepEqual(decisionOptions('Manager'), ['APPROVE', 'REJECT', 'RETURN']);
  });

  it('từ chối và trả lại bắt buộc có lý do', () => {
    assert.equal(reasonRequired('REJECT'), true);
    assert.equal(reasonRequired('RETURN'), true);
    assert.equal(reasonRequired('APPROVE'), false);
    assert.deepEqual(validateDecision({ decision: 'REJECT', reason: '  ', level: 'Staff' }), { valid: false, error: 'reasonRequired' });
    assert.equal(validateDecision({ decision: 'REJECT', reason: 'sai mô tả', level: 'Staff' }).valid, true);
    assert.equal(validateDecision({ decision: 'APPROVE', level: 'Staff' }).valid, true);
  });

  it('chặn quyết định không thuộc cấp và chưa chọn', () => {
    assert.deepEqual(validateDecision({ decision: 'RETURN', reason: 'x', level: 'Staff' }), { valid: false, error: 'notAllowed' });
    assert.deepEqual(validateDecision({ level: 'Staff' }), { valid: false, error: 'decisionRequired' });
  });

  it('dựng body: bỏ comment rỗng, số dòng sai thành null', () => {
    const body = buildDecisionPayload({
      decision: 'REJECT',
      reason: '  thiếu ví dụ ',
      comments: [{ content: ' mục 2 sai ', lineNumber: '12' }, { content: '   ' }, { content: 'chung', lineNumber: 'abc' }],
    });
    assert.deepEqual(body, {
      decision: 'REJECT',
      reason: 'thiếu ví dụ',
      comments: [{ content: 'mục 2 sai', lineNumber: 12 }, { content: 'chung', lineNumber: null }],
    });
    assert.deepEqual(buildDecisionPayload({ decision: 'APPROVE' }), { decision: 'APPROVE', reason: null, comments: [] });
  });
});

describe('Tách biệt nhiệm vụ (WF-22) và quyền', () => {
  const staff = { id: 'u1', roles: ['Staff'] };

  it('cho phép Staff duyệt task cấp Staff của người khác', () => {
    assert.equal(decisionBlock({ task: task(), user: staff }), null);
  });

  it('khóa khi người dùng là người nộp (WF-22)', () => {
    assert.equal(decisionBlock({ task: task({ submitterId: 'u1' }), user: staff }), 'self');
  });

  it('khóa khi task đã xử lý, ưu tiên hơn các lý do khác', () => {
    assert.equal(decisionBlock({ task: task({ status: 'Approved', submitterId: 'u1' }), user: staff }), 'closed');
  });

  it('khóa khi sai vai trò hoặc chưa có thông tin', () => {
    assert.equal(decisionBlock({ task: task({ level: 'Manager' }), user: staff }), 'role');
    assert.equal(decisionBlock({ task: task(), user: { id: 'u2', roles: ['Developer'] } }), 'role');
    assert.equal(decisionBlock({ task: null, user: staff }), 'role');
    assert.equal(decisionBlock({ task: task(), user: null }), 'role');
  });

  it('Administrator duyệt được cả hai cấp', () => {
    assert.equal(decisionBlock({ task: task({ level: 'Manager' }), user: { id: 'a', roles: ['Administrator'] } }), null);
  });
});

describe('Chi tiết duyệt (WF-03/04/05)', () => {
  it('chuẩn hóa phản hồi của GET /reviews/{id}', () => {
    const detail = normalizeReviewDetail({
      task: { id: 't1', level: 'Manager', status: 'Pending', submitterId: 'dev' },
      document: { id: 'd1', title: 'Tài liệu' },
      versionUnderReview: { versionNo: 3, content: 'mới' },
      changeLog: [{ versionNo: 3 }, { versionNo: 1 }, { versionNo: 2 }],
      lastApprovedVersion: { versionNo: 1, content: 'cũ' },
      decisions: [{ reviewerId: 'r1', reviewerName: 'Lan', decision: 'APPROVE', reason: null, decidedAt: 'x' }],
      comments: [{ userId: 'r1', content: 'sai mục 2', lineNumber: 4 }],
    });
    assert.equal(detail.task.level, 'Manager');
    assert.equal(detail.version.content, 'mới');
    assert.deepEqual(detail.changeLog.map((v) => v.versionNo), [1, 2, 3]);
    assert.equal(detail.lastApproved.content, 'cũ');
    assert.equal(detail.decisions[0].reviewerName, 'Lan');
    assert.deepEqual(detail.comments[0], { userId: 'r1', userName: null, content: 'sai mục 2', lineNumber: 4, createdAt: null });
  });

  it('thiếu trường thì dùng giá trị rỗng, không lỗi', () => {
    const detail = normalizeReviewDetail({ task: { id: 't' } });
    assert.equal(detail.version, null);
    assert.equal(detail.lastApproved, null);
    assert.deepEqual(detail.changeLog, []);
    assert.deepEqual(detail.decisions, []);
    assert.deepEqual(detail.comments, []);
    assert.equal(normalizeReviewDetail(null).task, null);
  });

  it('tên người duyệt rơi về 8 ký tự đầu của id', () => {
    assert.equal(personLabel('Lan', 'abcdef1234'), 'Lan');
    assert.equal(personLabel(null, 'abcdef1234'), 'abcdef12');
  });
});
