import test from 'node:test';
import assert from 'node:assert/strict';
import apiClient from '../src/services/api/apiClient.js';
import { governanceApi } from '../src/features/governance/api.js';
import { templatesApi } from '../src/features/templates/api.js';
import viteConfig from '../vite.config.js';

const originalGet = apiClient.get;
const originalPut = apiClient.put;
const originalPost = apiClient.post;
const originalDelete = apiClient.delete;

test.afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
  apiClient.post = originalPost;
  apiClient.delete = originalDelete;
});

test('governanceApi.getPolicies calls endpoint and returns list', async () => {
  const policies = [{ id: 'p-1', name: 'Security Policy', scopeType: 'WORKSPACE' }];
  apiClient.get = async (url, config) => {
    assert.equal(url, '/api/v1/governance/policies');
    assert.deepEqual(config.params, { scopeType: 'WORKSPACE' });
    return { data: policies };
  };

  const result = await governanceApi.getPolicies({ scopeType: 'WORKSPACE' });
  assert.deepEqual(result, policies);
});

test('governanceApi.createPolicy serializes config object into JSON string', async () => {
  const payload = {
    name: 'Strict Policy',
    scopeType: 'REPOSITORY',
    scopeId: 'repo-100',
    config: { maxDriftThreshold: 0.15, requireApprovalForDocTypes: ['API_REFERENCE'] },
  };

  apiClient.post = async (url, body) => {
    assert.equal(url, '/api/v1/governance/policies');
    assert.equal(body.name, 'Strict Policy');
    assert.equal(typeof body.config, 'string');
    assert.deepEqual(JSON.parse(body.config), payload.config);
    return { data: { id: 'p-new', ...body } };
  };

  const created = await governanceApi.createPolicy(payload);
  assert.equal(created.id, 'p-new');
});

test('governanceApi.resolvePolicy sends resolution request to resolver endpoint', async () => {
  const resolveReq = {
    repositoryId: 'repo-1',
    moduleId: 'billing',
    docType: 'API_REFERENCE',
  };
  const resolvedResponse = {
    matchedScopeType: 'DOC_TYPE',
    effectiveConfig: { maxDriftThreshold: 0.1, autoUpdateEnabled: false },
  };

  apiClient.post = async (url, body) => {
    assert.equal(url, '/api/v1/governance/policies/resolve');
    assert.deepEqual(body, resolveReq);
    return { data: resolvedResponse };
  };

  const result = await governanceApi.resolvePolicy(resolveReq);
  assert.deepEqual(result, resolvedResponse);
});

test('governanceApi.getHealthDashboard calls /dashboard/health', async () => {
  const dashboardData = {
    overallFreshnessScore: 92.5,
    overallCoverageScore: 88.0,
    openDriftAlertCount: 2,
    averageConfidenceScore: 0.89,
    repositories: [],
  };

  apiClient.get = async (url) => {
    assert.equal(url, '/api/v1/governance/dashboard/health');
    return { data: dashboardData };
  };

  const res = await governanceApi.getHealthDashboard();
  assert.deepEqual(res, dashboardData);
});

test('governanceApi.exportHealthReportCsv passes format=csv and responseType=text', async () => {
  const csvContent = 'Repository,Freshness,Coverage\nrepo-1,90,85';

  apiClient.get = async (url, config) => {
    assert.equal(url, '/api/v1/governance/reports/health');
    assert.equal(config.params.format, 'csv');
    assert.equal(config.responseType, 'text');
    return { data: csvContent };
  };

  const csv = await governanceApi.exportHealthReportCsv();
  assert.equal(csv, csvContent);
});

test('templatesApi.rollbackTemplate calls template rollback endpoint', async () => {
  const rollbackRes = {
    id: 't-1',
    name: 'Standard README',
    currentVersionNo: 3,
  };

  apiClient.post = async (url, body) => {
    assert.equal(url, '/api/v1/governance/templates/t-1/rollback');
    assert.deepEqual(body, {
      targetVersionNo: 2,
      changeNote: 'Revert bad edit',
    });
    return { data: rollbackRes };
  };

  const res = await templatesApi.rollbackTemplate('t-1', 2, 'Revert bad edit');
  assert.deepEqual(res, rollbackRes);
});

test('templatesApi.previewTemplate serializes preview request payload', async () => {
  const previewRes = {
    previewMarkdown: '# Title\n\n## Summary\n',
    totalSections: 2,
  };

  apiClient.post = async (url, body) => {
    assert.equal(url, '/api/v1/governance/templates/t-1/preview');
    assert.ok(typeof body.sections === 'string');
    return { data: previewRes };
  };

  const res = await templatesApi.previewTemplate('t-1', {
    sections: [{ key: 'summary', title: 'Summary' }],
    formatRules: { output: 'markdown' },
  });
  assert.deepEqual(res, previewRes);
});

test('templatesApi collections CRUD operates on /api/v1/governance/collections', async () => {
  const collections = [{ id: 'col-1', name: 'Core Architecture' }];
  apiClient.get = async (url) => {
    assert.equal(url, '/api/v1/governance/collections');
    return { data: collections };
  };

  const res = await templatesApi.getCollections();
  assert.deepEqual(res, collections);

  apiClient.post = async (url, body) => {
    assert.equal(url, '/api/v1/governance/collections');
    assert.equal(body.name, 'New Collection');
    return { data: { id: 'col-2', ...body } };
  };

  const created = await templatesApi.createCollection({ name: 'New Collection' });
  assert.equal(created.name, 'New Collection');
});

test('Vite proxies governance service requests to http://localhost:8085', () => {
  assert.equal(viteConfig.server.proxy['/api/v1/governance'].target, 'http://localhost:8085');
});
