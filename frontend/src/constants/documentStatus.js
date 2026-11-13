/**
 * Metadata and display configurations for Document, Publish, and PR statuses.
 * Every status provides textual labels for Vietnamese and English,
 * accompanied by visual tone indicators.
 */

export const DOCUMENT_STATUS = Object.freeze({
  DRAFT: {
    key: 'DRAFT',
    labelVi: 'Bản nháp',
    labelEn: 'Draft',
    tone: 'neutral',
    descriptionVi: 'Tài liệu đang trong giai đoạn soạn thảo ban đầu',
    descriptionEn: 'Document is currently in initial draft stage',
  },
  PENDING_DEVELOPER_ACTION: {
    key: 'PENDING_DEVELOPER_ACTION',
    labelVi: 'Chờ Developer xử lý',
    labelEn: 'Pending Developer Action',
    tone: 'warning',
    descriptionVi: 'Cần lập trình viên thực hiện hành động bổ sung',
    descriptionEn: 'Developer action required to proceed',
  },
  IN_REVIEW_STAFF: {
    key: 'IN_REVIEW_STAFF',
    labelVi: 'Chờ Staff duyệt',
    labelEn: 'In Review (Staff)',
    tone: 'info',
    descriptionVi: 'Đang trong quy trình xem xét bởi Staff',
    descriptionEn: 'Under evaluation by Staff reviewer',
  },
  IN_REVIEW_MANAGER: {
    key: 'IN_REVIEW_MANAGER',
    labelVi: 'Chờ Manager duyệt',
    labelEn: 'In Review (Manager)',
    tone: 'indigo',
    descriptionVi: 'Đang trong quy trình xem xét bởi Manager',
    descriptionEn: 'Under evaluation by Manager reviewer',
  },
  CHANGES_REQUESTED: {
    key: 'CHANGES_REQUESTED',
    labelVi: 'Cần chỉnh sửa',
    labelEn: 'Changes Requested',
    tone: 'orange',
    descriptionVi: 'Người duyệt yêu cầu sửa đổi nội dung trước khi duyệt',
    descriptionEn: 'Reviewer requested changes before approval',
  },
  APPROVED: {
    key: 'APPROVED',
    labelVi: 'Đã duyệt',
    labelEn: 'Approved',
    tone: 'success',
    descriptionVi: 'Nội dung đã được các cấp có thẩm quyền phê duyệt',
    descriptionEn: 'Content has been approved by reviewers',
  },
  PENDING_MERGE: {
    key: 'PENDING_MERGE',
    labelVi: 'Chờ merge',
    labelEn: 'Pending Merge',
    tone: 'cyan',
    descriptionVi: 'Tài liệu đã duyệt, đang đợi hợp nhất vào kho lưu trữ',
    descriptionEn: 'Approved document waiting for repository merge',
  },
  PUBLISHED: {
    key: 'PUBLISHED',
    labelVi: 'Đã xuất bản',
    labelEn: 'Published',
    tone: 'emerald',
    descriptionVi: 'Tài liệu đã được xuất bản chính thức vào tài liệu dự án',
    descriptionEn: 'Officially published to active documentation',
  },
  REJECTED: {
    key: 'REJECTED',
    labelVi: 'Bị từ chối',
    labelEn: 'Rejected',
    tone: 'danger',
    descriptionVi: 'Tài liệu bị từ chối phê duyệt',
    descriptionEn: 'Document draft was rejected',
  },
  DISMISSED: {
    key: 'DISMISSED',
    labelVi: 'Đã bỏ qua',
    labelEn: 'Dismissed',
    tone: 'slate',
    descriptionVi: 'Tài liệu hoặc đề xuất bị hủy bỏ',
    descriptionEn: 'Document or update was dismissed',
  },
  SUPERSEDED: {
    key: 'SUPERSEDED',
    labelVi: 'Đã bị thay thế',
    labelEn: 'Superseded',
    tone: 'muted',
    descriptionVi: 'Đã có phiên bản mới thay thế phiên bản này',
    descriptionEn: 'Superseded by a newer approved version',
  },
});

export const PUBLISH_STATUS = Object.freeze({
  NOT_PUBLISHED: {
    key: 'NOT_PUBLISHED',
    labelVi: 'Chưa xuất bản',
    labelEn: 'Not Published',
    tone: 'neutral',
    descriptionVi: 'Tài liệu chưa được ghi vào nhánh lưu trữ',
    descriptionEn: 'Not yet committed to storage branch',
  },
  FAILED: {
    key: 'FAILED',
    labelVi: 'Lỗi xuất bản',
    labelEn: 'Publish Failed',
    tone: 'danger',
    descriptionVi: 'Gặp lỗi trong quá trình tự động xuất bản tài liệu',
    descriptionEn: 'Error encountered during publishing pipeline',
  },
  COMMITTED_TO_DOCS_BRANCH: {
    key: 'COMMITTED_TO_DOCS_BRANCH',
    labelVi: 'Đã commit nhánh docs',
    labelEn: 'Committed to Docs Branch',
    tone: 'info',
    descriptionVi: 'Nội dung đã ghi nhận trên nhánh lưu trữ tài liệu',
    descriptionEn: 'Changes committed to documentation branch',
  },
  IN_TARGET_BRANCH: {
    key: 'IN_TARGET_BRANCH',
    labelVi: 'Đã vào nhánh đích',
    labelEn: 'In Target Branch',
    tone: 'success',
    descriptionVi: 'Nội dung đã được hợp nhất vào nhánh chính của dự án',
    descriptionEn: 'Successfully merged into repository target branch',
  },
});

export const PR_STATUS = Object.freeze({
  NONE: {
    key: 'NONE',
    labelVi: 'Chưa có PR',
    labelEn: 'No PR',
    tone: 'neutral',
    descriptionVi: 'Chưa tạo Pull Request tương ứng trên Git repository',
    descriptionEn: 'No active pull request linked',
  },
  PENDING_MERGE: {
    key: 'PENDING_MERGE',
    labelVi: 'Chờ merge',
    labelEn: 'Pending Merge',
    tone: 'warning',
    descriptionVi: 'Pull Request đang mở và chờ merge',
    descriptionEn: 'Pull request is open and awaiting merge',
  },
  CLOSED_UNMERGED: {
    key: 'CLOSED_UNMERGED',
    labelVi: 'Đóng, chưa merge',
    labelEn: 'Closed Unmerged',
    tone: 'danger',
    descriptionVi: 'Pull Request đã đóng mà không được hợp nhất',
    descriptionEn: 'Pull request was closed without merge',
  },
  MERGED: {
    key: 'MERGED',
    labelVi: 'Đã merge',
    labelEn: 'Merged',
    tone: 'success',
    descriptionVi: 'Pull Request đã được hợp nhất thành công',
    descriptionEn: 'Pull request has been merged successfully',
  },
});

export function getDocStatusMeta(status, lang = 'vi') {
  const match = DOCUMENT_STATUS[status];
  if (match) {
    return {
      key: match.key,
      label: lang === 'en' ? match.labelEn : match.labelVi,
      description: lang === 'en' ? match.descriptionEn : match.descriptionVi,
      tone: match.tone,
    };
  }
  return {
    key: status || 'UNKNOWN',
    label: status || (lang === 'en' ? 'Unknown' : 'Không xác định'),
    description: status || '',
    tone: 'neutral',
  };
}

export function getPublishStatusMeta(status, lang = 'vi') {
  const match = PUBLISH_STATUS[status];
  if (match) {
    return {
      key: match.key,
      label: lang === 'en' ? match.labelEn : match.labelVi,
      description: lang === 'en' ? match.descriptionEn : match.descriptionVi,
      tone: match.tone,
    };
  }
  return {
    key: status || 'UNKNOWN',
    label: status || (lang === 'en' ? 'Unknown' : 'Không xác định'),
    description: status || '',
    tone: 'neutral',
  };
}

export function getPrStatusMeta(status, lang = 'vi') {
  const match = PR_STATUS[status];
  if (match) {
    return {
      key: match.key,
      label: lang === 'en' ? match.labelEn : match.labelVi,
      description: lang === 'en' ? match.descriptionEn : match.descriptionVi,
      tone: match.tone,
    };
  }
  return {
    key: status || 'UNKNOWN',
    label: status || (lang === 'en' ? 'Unknown' : 'Không xác định'),
    description: status || '',
    tone: 'neutral',
  };
}
