import apiClient from '../../services/api/apiClient.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const BASE_URL = env.VITE_GOVERNANCE_API_URL || '/api/v1/governance';

export const governanceApi = {
  // Policies
  async getPolicies(params = {}) {
    const res = await apiClient.get(`${BASE_URL}/policies`, { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  async getPolicyById(id) {
    const res = await apiClient.get(`${BASE_URL}/policies/${id}`);
    return res.data;
  },

  async createPolicy(data) {
    const configStr = typeof data.config === 'string' ? data.config : JSON.stringify(data.config);
    const res = await apiClient.post(`${BASE_URL}/policies`, { ...data, config: configStr });
    return res.data;
  },

  async updatePolicy(id, data) {
    const configStr = typeof data.config === 'string' ? data.config : JSON.stringify(data.config);
    const res = await apiClient.put(`${BASE_URL}/policies/${id}`, { ...data, config: configStr });
    return res.data;
  },

  async deletePolicy(id) {
    const res = await apiClient.delete(`${BASE_URL}/policies/${id}`);
    return res.data;
  },

  async resolvePolicy(params) {
    const res = await apiClient.post(`${BASE_URL}/policies/resolve`, params);
    return res.data;
  },

  // Dashboard Read Model
  async getHealthDashboard() {
    const res = await apiClient.get(`${BASE_URL}/dashboard/health`);
    return res.data;
  },

  // Reports
  async getHealthReport(params = {}) {
    const res = await apiClient.get(`${BASE_URL}/reports/health`, { params });
    return res.data;
  },

  async getComplianceReport(params = {}) {
    const res = await apiClient.get(`${BASE_URL}/reports/compliance`, { params });
    return res.data;
  },

  async exportHealthReportCsv(params = {}) {
    const res = await apiClient.get(`${BASE_URL}/reports/health`, {
      params: { ...params, format: 'csv' },
      responseType: 'text',
    });
    return res.data;
  },

  async exportComplianceReportCsv(params = {}) {
    const res = await apiClient.get(`${BASE_URL}/reports/compliance`, {
      params: { ...params, format: 'csv' },
      responseType: 'text',
    });
    return res.data;
  },
};

export default governanceApi;
