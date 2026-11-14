// Giá trị trùng với CHECK constraint của bảng update_suggestion (backend).
export const SUGGESTION_STATUS = Object.freeze({
  PENDING: 'Pending Developer Action',
  ACCEPTED: 'Accepted',
  DISMISSED: 'Dismissed',
  SUPERSEDED: 'Superseded',
})

export const ALL_STATUSES = 'all'

// Danh sách lý do Dismiss dùng chung cho cả nhóm (điểm chốt số 4).
export const DISMISS_REASONS = Object.freeze([
  'notApplicable',
  'docCorrect',
  'wrongSuggestion',
  'duplicate',
  'other',
])
export const OTHER_REASON = 'other'
export const MIN_OTHER_REASON_LENGTH = 3
