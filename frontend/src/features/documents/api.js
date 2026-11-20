import apiClient from '../../services/api/apiClient.js';
import {
  MOCK_DOCUMENTS,
  MOCK_VERSIONS_BY_DOC,
  MOCK_LINKS_BY_DOC,
  MOCK_INTEGRITY_BY_DOC,
  MOCK_REPOSITORIES,
} from '../../mocks/documents.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const isMockMode = Boolean(import.meta.env?.DEV && env.VITE_API_MODE === 'mock');
const DOCUMENTS_API = '/api/v1/documents';

// In-memory mock store for session modifications
let activeMockDocs = [...MOCK_DOCUMENTS];
let activeMockVersions = { ...MOCK_VERSIONS_BY_DOC };

/**
 * Normalizes document lists to ensure a uniform { items, total, page, size } contract,
 * avoiding crashes when backend returns a direct List<DocumentResponse>.
 */
function normalizeDocumentPageResult(data, page = 0, size = 20) {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page,
      size,
    };
  }
  if (data && Array.isArray(data.items)) {
    return data;
  }
  return {
    items: [],
    total: 0,
    page,
    size,
  };
}

export const documentsApi = {
  /**
   * Retrieves list of available repositories
   */
  async getRepositories() {
    if (isMockMode) {
      return MOCK_REPOSITORIES;
    }
    const { data } = await apiClient.get('/api/v1/repositories');
    return Array.isArray(data) ? data : [];
  },

  async getAvailableGitHubRepositories() {
    let connectionId = localStorage.getItem('ld_github_connection_id');
    if (!connectionId) {
      throw new Error('Chưa có kết nối GitHub. Hãy đăng nhập lại để liên kết repository.');
    }
    const { data } = await apiClient.get(`/api/v1/integrations/github/connections/${connectionId}/available-repos`);
    return Array.isArray(data) ? data : [];
  },

  async connectGitHubAppInstallation(installationId) {
    const { data } = await apiClient.post('/api/v1/integrations/github/connections/app-installation', {
      installationId: String(installationId),
    });
    localStorage.setItem('ld_github_connection_id', data.id);
    return data;
  },

  async getRepositoryContents(repositoryId, path = '') {
    const { data } = await apiClient.get(`/api/v1/repositories/${repositoryId}/contents`, {
      params: path ? { path } : {},
    });
    return Array.isArray(data) ? data : [];
  },

  async getRepositoryFile(repositoryId, path) {
    const { data } = await apiClient.get(`/api/v1/repositories/${repositoryId}/file`, { params: { path } });
    return data;
  },

  async connectRepository(connectionId, repo) {
    const { data } = await apiClient.post('/api/v1/repositories', {
      connectionId,
      githubRepoId: repo.id,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
    });
    return data;
  },

  async getAnalysisRuns(repositoryId) {
    const { data } = await apiClient.get('/api/v1/analysis-runs', { params: { repositoryId } });
    return Array.isArray(data) ? data : [];
  },

  async startAnalysisRun(repositoryId) {
    const { data } = await apiClient.post(`/api/v1/repositories/${repositoryId}/analysis-runs`);
    return data;
  },

  async getAnalysisRun(runId) {
    const { data } = await apiClient.get(`/api/v1/analysis-runs/${runId}`);
    return data;
  },

  async getCodeEntities(repositoryId, commitSha, q = '') {
    const { data } = await apiClient.get(`/api/v1/repositories/${repositoryId}/code-entities`, {
      params: { commitSha, ...(q ? { q } : {}) },
    });
    return Array.isArray(data) ? data : [];
  },

  async getGenerationJob(jobId) {
    const { data } = await apiClient.get(`${DOCUMENTS_API}/generation-jobs/${jobId}`);
    return data;
  },

  async retryGenerationJob(jobId) {
    const { data } = await apiClient.post(`${DOCUMENTS_API}/generation-jobs/${jobId}/retry`);
    return data;
  },

  /**
   * Retrieves paginated documents with optional repository and status filtering.
   */
  async getDocuments({ repositoryId, docStatus, page = 0, size = 20 } = {}) {
    if (isMockMode) {
      let filtered = [...activeMockDocs];
      if (repositoryId) {
        filtered = filtered.filter((d) => d.repositoryId === repositoryId);
      }
      if (docStatus) {
        filtered = filtered.filter((d) => d.docStatus === docStatus);
      }
      const start = page * size;
      const items = filtered.slice(start, start + size);
      return {
        items,
        total: filtered.length,
        page,
        size,
      };
    }

    const params = { page, size };
    if (repositoryId) params.repositoryId = repositoryId;
    if (docStatus) params.docStatus = docStatus;

    const res = await apiClient.get(DOCUMENTS_API, { params });
    return normalizeDocumentPageResult(res.data, page, size);
  },

  /**
   * Retrieves document metadata by ID.
   */
  async getDocumentById(id) {
    if (isMockMode) {
      const doc = activeMockDocs.find((d) => d.id === id);
      if (!doc) {
        const error = new Error(`Document not found: ${id}`);
        error.response = { status: 404, data: { detail: 'Document not found' } };
        throw error;
      }
      return doc;
    }

    const res = await apiClient.get(`${DOCUMENTS_API}/${id}`);
    return res.data;
  },

  /**
   * Retrieves version history timeline for a document.
   */
  async getDocumentVersions(id) {
    if (isMockMode) {
      const versions = activeMockVersions[id] || [];
      // Return sorted descending (newest on top) for UI timeline
      return [...versions].sort((a, b) => b.versionNo - a.versionNo);
    }

    const res = await apiClient.get(`${DOCUMENTS_API}/${id}/versions`);
    const list = Array.isArray(res.data) ? res.data : [];
    return [...list].sort((a, b) => b.versionNo - a.versionNo);
  },

  /**
   * Retrieves specific version details including content and AI generation metadata.
   */
  async getDocumentVersion(id, versionNo) {
    if (isMockMode) {
      const list = activeMockVersions[id] || [];
      const match = list.find((v) => v.versionNo === Number(versionNo));
      if (!match) {
        const error = new Error(`Version ${versionNo} not found`);
        error.response = { status: 404, data: { detail: 'Version not found' } };
        throw error;
      }
      return match;
    }

    const res = await apiClient.get(`${DOCUMENTS_API}/${id}/versions/${versionNo}`);
    return res.data;
  },

  /**
   * Updates draft content (GEN-07).
   * Validates baseVersionNo to detect conflicts (409).
   */
  async updateDraft(id, { content, baseVersionNo }) {
    if (isMockMode) {
      const doc = activeMockDocs.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');

      // Conflict detection
      if (baseVersionNo !== undefined && doc.currentVersionNo !== baseVersionNo) {
        const conflictErr = new Error('Bản nháp đã thay đổi. Vui lòng tải lại trang.');
        conflictErr.response = {
          status: 409,
          data: {
            title: 'Conflict',
            status: 409,
            detail: 'Bản nháp đã thay đổi bởi phiên làm việc khác. Phiên bản hiện tại là ' + doc.currentVersionNo,
          },
        };
        throw conflictErr;
      }

      const nextVerNo = doc.currentVersionNo + 1;
      const newVersion = {
        id: `v-mock-${Date.now()}`,
        documentId: id,
        versionNo: nextVerNo,
        content,
        contentRedacted: false,
        actorRole: 'Developer',
        actorUserId: '00000000-0000-0000-0000-000000000001',
        changeSource: 'MANUAL_EDIT',
        statusAtVersion: doc.docStatus,
        sourceCommitSha: null,
        sourcePrNumber: null,
        sourcePrKind: null,
        reason: 'Chỉnh sửa bản nháp thủ công',
        rolledBackFromVersionNo: null,
        createdAt: new Date().toISOString(),
      };

      if (!activeMockVersions[id]) activeMockVersions[id] = [];
      activeMockVersions[id].push(newVersion);

      doc.currentVersionNo = nextVerNo;
      doc.updatedAt = new Date().toISOString();

      return newVersion;
    }

    const res = await apiClient.put(`${DOCUMENTS_API}/${id}/draft`, { content, baseVersionNo });
    return res.data;
  },

  /**
   * Computes or fetches textual diff between two versions (VER-04).
   */
  async getDiff(id, { from, to }) {
    if (isMockMode) {
      const vFrom = await this.getDocumentVersion(id, from);
      const vTo = await this.getDocumentVersion(id, to);

      if (vFrom.contentRedacted || vTo.contentRedacted) {
        const redactedErr = new Error('Nội dung phiên bản đã bị che không thể so sánh');
        redactedErr.response = {
          status: 409,
          data: { status: 409, detail: 'Một trong hai phiên bản đã bị che nội dung vĩnh viễn' },
        };
        throw redactedErr;
      }

      return {
        fromVersion: from,
        toVersion: to,
        diffLines: null, // Will trigger client-side diff with oldText and newText
        oldText: vFrom.content || '',
        newText: vTo.content || '',
      };
    }

    const res = await apiClient.get(`${DOCUMENTS_API}/${id}/diff`, { params: { from, to } });
    return res.data;
  },

  /**
   * Rolls back document to a prior version (VER-05, VER-09).
   */
  async rollbackDocument(id, { targetVersionNo, reason }) {
    if (isMockMode) {
      const doc = activeMockDocs.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');

      const targetVer = (activeMockVersions[id] || []).find((v) => v.versionNo === Number(targetVersionNo));
      if (!targetVer) throw new Error('Phiên bản đích không tồn tại');
      if (targetVer.contentRedacted) {
        const err = new Error('Phiên bản đích đã bị che nội dung');
        err.response = { status: 409, data: { detail: 'Không thể rollback về phiên bản đã bị che nội dung' } };
        throw err;
      }

      const nextVerNo = doc.currentVersionNo + 1;
      const requiresReview = targetVer.statusAtVersion !== 'APPROVED' && targetVer.statusAtVersion !== 'PUBLISHED';

      const rollbackVer = {
        id: `v-rb-${Date.now()}`,
        documentId: id,
        versionNo: nextVerNo,
        content: targetVer.content,
        contentRedacted: false,
        actorRole: 'Developer',
        actorUserId: '00000000-0000-0000-0000-000000000001',
        changeSource: 'ROLLBACK',
        statusAtVersion: requiresReview ? 'DRAFT' : 'APPROVED',
        sourceCommitSha: null,
        sourcePrNumber: null,
        sourcePrKind: null,
        reason: reason || `Rollback về phiên bản ${targetVersionNo}`,
        rolledBackFromVersionNo: targetVersionNo,
        createdAt: new Date().toISOString(),
      };

      activeMockVersions[id].push(rollbackVer);
      doc.currentVersionNo = nextVerNo;
      doc.docStatus = rollbackVer.statusAtVersion;
      doc.updatedAt = new Date().toISOString();

      return {
        ...rollbackVer,
        requiresReview,
        docStatus: doc.docStatus,
      };
    }

    const res = await apiClient.post(`${DOCUMENTS_API}/${id}/rollback`, { targetVersionNo, reason });
    return res.data;
  },

  /**
   * Verifies SHA-256 version hash chain integrity (VER-08).
   */
  async verifyIntegrity(id) {
    if (isMockMode) {
      return (
        MOCK_INTEGRITY_BY_DOC[id] || {
          documentId: id,
          isValid: true,
          problems: [],
        }
      );
    }

    const res = await apiClient.get(`${DOCUMENTS_API}/${id}/integrity`);
    return res.data;
  },

  /**
   * Retrieves code and VCS links attached to document.
   */
  async getDocumentLinks(id) {
    if (isMockMode) {
      return MOCK_LINKS_BY_DOC[id] || [];
    }

    const res = await apiClient.get(`${DOCUMENTS_API}/${id}/links`);
    return res.data;
  },

  /**
   * Submits asynchronous AI document generation request (GEN-02, GEN-03).
   */
  async generateDocument({ scopeType = 'REPOSITORY', scopeReference = 'selected entities', repositoryId, templateId, commitSha, codeEntityIds, title, pathInRepo }) {
    if (isMockMode) {
      const newDocId = `d-ai-${Date.now()}`;
      const newDoc = {
        id: newDocId,
        repositoryId,
        title: title || 'Tài liệu sinh tự động',
        pathInRepo: pathInRepo || 'docs/generated.md',
        docType: 'README',
        templateId,
        collectionId: null,
        ownerId: '00000000-0000-0000-0000-000000000001',
        currentVersionId: `v-ai-${Date.now()}`,
        currentVersionNo: 1,
        docStatus: 'DRAFT',
        publishStatus: 'NOT_PUBLISHED',
        prStatus: 'NONE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      activeMockDocs.unshift(newDoc);
      activeMockVersions[newDocId] = [
        {
          id: newDoc.currentVersionId,
          documentId: newDocId,
          versionNo: 1,
          content: `# ${newDoc.title}\n\nNội dung được AI sinh tự động dựa trên mã nguồn phạm vi ${scopeType}: \`${scopeReference}\`.`,
          contentRedacted: false,
          actorRole: 'AI',
          actorUserId: null,
          changeSource: 'AI_GENERATION',
          statusAtVersion: 'DRAFT',
          sourceCommitSha: commitSha || 'mock-sha-latest',
          reason: 'AI generation',
          createdAt: new Date().toISOString(),
          generation: {
            overallConfidence: 0.89,
            provider: 'mock-ai',
            model: 'mock-model-v1',
            sections: [{ key: 'overview', title: 'Tổng quan', confidence: 0.92 }],
            evidence: [{ filePath: scopeReference, entityKind: 'file', commitHash: commitSha || 'mock-sha' }],
          },
        },
      ];

      return {
        jobId: `job-${Date.now()}`,
        status: 'QUEUED',
        message: 'Yêu cầu sinh tài liệu đã được tiếp nhận.',
        createdDocumentId: newDocId,
      };
    }

    const res = await apiClient.post(`${DOCUMENTS_API}/generate`, {
      scopeType,
      scopeReference,
      repositoryId,
      templateId,
      commitSha,
      codeEntityIds,
      title,
      pathInRepo,
    });
    return res.data;
  },

  async createDocument({ repositoryId, title, pathInRepo, content, docType = 'README' }) {
    const { data } = await apiClient.post(DOCUMENTS_API, {
      repositoryId,
      title,
      pathInRepo,
      content,
      docType,
    });
    return data;
  },

  /**
   * Submits document for approval workflow (GEN-10).
   * // CHỜ XÁC NHẬN: Tích hợp với workflow-service (Huy)
   */
  async submitForReview(id) {
    if (isMockMode) {
      const doc = activeMockDocs.find((d) => d.id === id);
      if (doc) {
        doc.docStatus = 'IN_REVIEW_STAFF';
        doc.updatedAt = new Date().toISOString();
      }
      return {
        success: true,
        docStatus: 'IN_REVIEW_STAFF',
        message: 'Đã nộp duyệt thành công. Tài liệu đang chờ Staff đánh giá.',
      };
    }

    const { data } = await apiClient.post(`/api/v1/documents/${id}/submit`);
    return data;
  },
};
