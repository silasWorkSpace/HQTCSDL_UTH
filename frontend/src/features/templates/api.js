import apiClient from '../../services/api/apiClient.js';
import {
  MOCK_TEMPLATES,
  MOCK_COLLECTIONS,
  MOCK_TEMPLATE_VERSIONS,
} from '../../mocks/templates.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const isMockMode = Boolean(import.meta.env?.DEV && env.VITE_API_MODE === 'mock');
const BASE_URL = env.VITE_GOVERNANCE_API_URL || '/api/v1/governance';
const http = {
  get: (path, config) => apiClient.get(`${BASE_URL}${path}`, config),
  post: (path, data, config) => apiClient.post(`${BASE_URL}${path}`, data, config),
  put: (path, data, config) => apiClient.put(`${BASE_URL}${path}`, data, config),
  delete: (path, config) => apiClient.delete(`${BASE_URL}${path}`, config),
};

let activeMockTemplates = [...MOCK_TEMPLATES];
let activeMockCollections = [...MOCK_COLLECTIONS];
let activeMockVersions = { ...MOCK_TEMPLATE_VERSIONS };

export const templatesApi = {
  /**
   * Retrieves list of templates with optional filtering.
   */
  async getTemplates({ docType, status } = {}) {
    if (isMockMode) {
      let list = [...activeMockTemplates];
      if (docType) list = list.filter((t) => t.docType === docType);
      if (status) list = list.filter((t) => t.status === status);
      return list;
    }

    const res = await http.get('/templates');
    let list = Array.isArray(res.data) ? res.data : [];
    if (docType) list = list.filter((t) => t.docType === docType);
    if (status) list = list.filter((t) => t.status === status);
    return list;
  },

  /**
   * Retrieves specific template details by ID.
   */
  async getTemplateById(id) {
    if (isMockMode) {
      const match = activeMockTemplates.find((t) => t.id === id);
      if (!match) {
        const error = new Error('Template not found');
        error.response = { status: 404, data: { detail: 'Template not found' } };
        throw error;
      }
      return match;
    }

    const res = await http.get(`/templates/${id}`);
    return res.data;
  },

  /**
   * Creates a new document template (TechLead only).
   */
  async createTemplate({ name, docType, description, sections, formatRules, status = 'ACTIVE' }) {
    const sectionsStr = typeof sections === 'string' ? sections : JSON.stringify(sections);
    const formatRulesStr = typeof formatRules === 'string' ? formatRules : formatRules ? JSON.stringify(formatRules) : null;

    if (isMockMode) {
      // Check duplicate name
      if (activeMockTemplates.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        const err = new Error('Tên template đã tồn tại');
        err.response = { status: 409, data: { detail: 'Tên template đã tồn tại trong hệ thống.' } };
        throw err;
      }

      const newId = `t-mock-${Date.now()}`;
      const newTpl = {
        id: newId,
        name,
        docType,
        description,
        currentVersionId: `tv-${Date.now()}`,
        currentVersionNo: 1,
        status,
        sections: sectionsStr,
        formatRules: formatRulesStr,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      activeMockTemplates.unshift(newTpl);
      activeMockVersions[newId] = [
        {
          id: newTpl.currentVersionId,
          versionNo: 1,
          sections: sectionsStr,
          formatRules: formatRulesStr,
          changeNote: 'Initial template creation',
          createdAt: new Date().toISOString(),
        },
      ];
      return newTpl;
    }

    const res = await http.post('/templates', {
      name,
      docType,
      description,
      sections: sectionsStr,
      formatRules: formatRulesStr,
    });
    return res.data;
  },

  /**
   * Updates an existing template, generating a new template version if sections change.
   */
  async updateTemplate(id, { name, docType, description, sections, formatRules }) {
    const sectionsStr = typeof sections === 'string' ? sections : JSON.stringify(sections);
    const formatRulesStr = typeof formatRules === 'string' ? formatRules : formatRules ? JSON.stringify(formatRules) : null;

    if (isMockMode) {
      const idx = activeMockTemplates.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error('Template not found');

      const existing = activeMockTemplates[idx];
      const nextVerNo = (existing.currentVersionNo || 1) + 1;
      const updated = {
        ...existing,
        name: name !== undefined ? name : existing.name,
        docType: docType !== undefined ? docType : existing.docType,
        description: description !== undefined ? description : existing.description,
        currentVersionNo: nextVerNo,
        sections: sectionsStr,
        formatRules: formatRulesStr,
        updatedAt: new Date().toISOString(),
      };

      activeMockTemplates[idx] = updated;

      if (!activeMockVersions[id]) activeMockVersions[id] = [];
      activeMockVersions[id].unshift({
        id: `tv-${Date.now()}`,
        versionNo: nextVerNo,
        sections: sectionsStr,
        formatRules: formatRulesStr,
        changeNote: 'Cập nhật cấu trúc template',
        createdAt: new Date().toISOString(),
      });

      return updated;
    }

    const res = await http.put(`/templates/${id}`, {
      name,
      docType,
      description,
      sections: sectionsStr,
      formatRules: formatRulesStr,
    });
    return res.data;
  },

  /**
   * Clones a template.
   */
  async cloneTemplate(id, newName) {
    if (isMockMode) {
      const source = activeMockTemplates.find((t) => t.id === id);
      if (!source) throw new Error('Source template not found');

      return this.createTemplate({
        name: newName || `${source.name} (Bản sao)`,
        docType: source.docType,
        description: source.description,
        sections: source.sections,
        formatRules: source.formatRules,
        status: 'DRAFT',
      });
    }

    const res = await http.post(`/templates/${id}/clone`, null, {
      params: newName ? { newName } : {},
    });
    return res.data;
  },

  /**
   * Retrieves version history of a template.
   */
  async getTemplateVersions(id) {
    if (isMockMode) {
      return activeMockVersions[id] || [];
    }

    const res = await http.get(`/templates/${id}/versions`);
    return res.data;
  },

  /**
   * Retrieves collections.
   */
  async getCollections() {
    if (isMockMode) {
      return activeMockCollections;
    }

    const res = await http.get('/collections');
    return Array.isArray(res.data) ? res.data : [];
  },

  /**
   * Seeds default templates.
   */
  async seedTemplates() {
    if (isMockMode) {
      return { success: true, message: 'Đã seed dữ liệu mẫu.' };
    }
    const res = await http.post('/templates/seed');
    return res.data;
  },

  /**
   * Rollback template to a previous version.
   */
  async rollbackTemplate(id, targetVersionNo, changeNote) {
    if (isMockMode) {
      const versions = activeMockVersions[id] || [];
      const target = versions.find(v => v.versionNo === targetVersionNo);
      if (!target) throw new Error('Target version not found');
      return this.updateTemplate(id, {
        sections: target.sections,
        formatRules: target.formatRules,
      });
    }
    const res = await http.post(`/templates/${id}/rollback`, {
      targetVersionNo,
      changeNote,
    });
    return res.data;
  },

  /**
   * Preview template render with variables.
   */
  async previewTemplate(id, { sections, formatRules, variables } = {}) {
    const sectionsStr = typeof sections === 'string' ? sections : sections ? JSON.stringify(sections) : null;
    const formatRulesStr = typeof formatRules === 'string' ? formatRules : formatRules ? JSON.stringify(formatRules) : null;
    const path = id ? `/templates/${id}/preview` : `/templates/preview`;
    const res = await http.post(path, {
      sections: sectionsStr,
      formatRules: formatRulesStr,
      variables,
    });
    return res.data;
  },

  async getCollectionById(id) {
    const res = await http.get(`/collections/${id}`);
    return res.data;
  },

  async createCollection({ name, description, ownerId, defaultTemplateId }) {
    const res = await http.post('/collections', { name, description, ownerId, defaultTemplateId });
    return res.data;
  },

  async updateCollection(id, { name, description, ownerId, defaultTemplateId }) {
    const res = await http.put(`/collections/${id}`, { name, description, ownerId, defaultTemplateId });
    return res.data;
  },

  async deleteCollection(id) {
    const res = await http.delete(`/collections/${id}`);
    return res.data;
  },
};
