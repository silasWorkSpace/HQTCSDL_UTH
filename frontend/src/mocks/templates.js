/**
 * Mock data for templates and collections module.
 * Incorporates the 5 standard seed templates (API Reference, README, Module Guide,
 * Onboarding Guide, ADR) and default collection metadata.
 */

export const MOCK_COLLECTIONS = [
  {
    id: 'c1000000-0000-0000-0000-000000000001',
    name: 'Default',
    description: 'Bộ sưu tập tài liệu mặc định',
    defaultTemplateId: 't1000000-0000-0000-0000-000000000002',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'c1000000-0000-0000-0000-000000000002',
    name: 'Backend Microservices',
    description: 'Bộ tài liệu quy chuẩn kỹ thuật cho toàn bộ service backend',
    defaultTemplateId: 't1000000-0000-0000-0000-000000000001',
    createdAt: '2026-10-15T09:00:00Z',
  },
];

export const MOCK_TEMPLATES = [
  {
    id: 't1000000-0000-0000-0000-000000000001',
    name: 'API Reference',
    docType: 'API_REFERENCE',
    description: 'Tham chiếu API: endpoint, tham số, giá trị trả về, lỗi.',
    currentVersionId: 'tv100000-0000-0000-0000-000000000001',
    currentVersionNo: 1,
    status: 'ACTIVE',
    sections: JSON.stringify({
      sections: [
        { key: 'overview', title: 'Tổng quan', required: true },
        { key: 'endpoints', title: 'Danh sách endpoint', required: true, placeholder: '{{endpoint_list}}', entity_kind: 'endpoint' },
        { key: 'parameters', title: 'Bảng tham số', required: true, placeholder: '{{parameter_table}}', entity_kind: 'parameter' },
        { key: 'responses', title: 'Giá trị trả về', required: true },
        { key: 'errors', title: 'Mã lỗi', required: false },
      ],
    }),
    formatRules: JSON.stringify({ output: 'markdown', language: 'vi', max_heading_depth: 3 }),
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 't1000000-0000-0000-0000-000000000002',
    name: 'README',
    docType: 'README',
    description: 'README chuẩn cho repo hoặc module.',
    currentVersionId: 'tv100000-0000-0000-0000-000000000002',
    currentVersionNo: 1,
    status: 'ACTIVE',
    sections: JSON.stringify({
      sections: [
        { key: 'overview', title: 'Giới thiệu', required: true },
        { key: 'getting_started', title: 'Bắt đầu nhanh', required: true },
        { key: 'usage', title: 'Cách sử dụng', required: true },
        { key: 'configuration', title: 'Cấu hình', required: false },
      ],
    }),
    formatRules: JSON.stringify({ output: 'markdown', language: 'vi', max_heading_depth: 3 }),
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 't1000000-0000-0000-0000-000000000003',
    name: 'Module Guide',
    docType: 'MODULE_GUIDE',
    description: 'Hướng dẫn module/package: class, phụ thuộc, ví dụ.',
    currentVersionId: 'tv100000-0000-0000-0000-000000000003',
    currentVersionNo: 1,
    status: 'ACTIVE',
    sections: JSON.stringify({
      sections: [
        { key: 'purpose', title: 'Mục đích', required: true },
        { key: 'classes', title: 'Danh sách class', required: true, placeholder: '{{class_list}}', entity_kind: 'class' },
        { key: 'dependencies', title: 'Phụ thuộc', required: true, placeholder: '{{dependency_list}}' },
        { key: 'examples', title: 'Ví dụ sử dụng', required: false },
      ],
    }),
    formatRules: JSON.stringify({ output: 'markdown', language: 'vi', max_heading_depth: 3 }),
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 't1000000-0000-0000-0000-000000000004',
    name: 'Onboarding Guide',
    docType: 'ONBOARDING_GUIDE',
    description: 'Hướng dẫn hội nhập lập trình viên mới.',
    currentVersionId: 'tv100000-0000-0000-0000-000000000004',
    currentVersionNo: 1,
    status: 'ACTIVE',
    sections: JSON.stringify({
      sections: [
        { key: 'welcome', title: 'Chào mừng', required: true },
        { key: 'architecture', title: 'Kiến trúc tổng quan', required: true },
        { key: 'local_setup', title: 'Cài đặt môi trường', required: true },
        { key: 'key_modules', title: 'Các module chính', required: true, placeholder: '{{module_list}}' },
        { key: 'contribution', title: 'Quy trình đóng góp', required: false },
      ],
    }),
    formatRules: JSON.stringify({ output: 'markdown', language: 'vi', max_heading_depth: 3 }),
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 't1000000-0000-0000-0000-000000000005',
    name: 'ADR',
    docType: 'ADR',
    description: 'Architecture Decision Record.',
    currentVersionId: 'tv100000-0000-0000-0000-000000000005',
    currentVersionNo: 1,
    status: 'ACTIVE',
    sections: JSON.stringify({
      sections: [
        { key: 'title', title: 'Tiêu đề quyết định', required: true },
        { key: 'status', title: 'Trạng thái', required: true },
        { key: 'context', title: 'Bối cảnh', required: true },
        { key: 'decision', title: 'Quyết định', required: true },
        { key: 'consequences', title: 'Hệ quả', required: true },
      ],
    }),
    formatRules: JSON.stringify({ output: 'markdown', language: 'vi', max_heading_depth: 3 }),
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
];

export const MOCK_TEMPLATE_VERSIONS = {
  't1000000-0000-0000-0000-000000000001': [
    {
      id: 'tv100000-0000-0000-0000-000000000001',
      versionNo: 1,
      sections: MOCK_TEMPLATES[0].sections,
      formatRules: MOCK_TEMPLATES[0].formatRules,
      changeNote: 'Phiên bản khởi tạo hệ thống (Seed)',
      createdAt: '2026-10-01T00:00:00Z',
    },
  ],
};
