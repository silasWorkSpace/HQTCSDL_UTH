import test from 'node:test';
import assert from 'node:assert/strict';
import apiClient from '../src/services/api/apiClient.js';
import { documentsApi } from '../src/features/documents/api.js';
import { authApi } from '../src/features/auth/authApi.js';
import viteConfig from '../vite.config.js';

const originalGet = apiClient.get;
const originalPut = apiClient.put;
const originalPost = apiClient.post;

test.afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
  apiClient.post = originalPost;
});

test('documentsApi.getDocuments normalizes the real API list response', async () => {
  const documents = [{ id: 'doc-1' }, { id: 'doc-2' }];
  apiClient.get = async (url, config) => {
    assert.equal(url, '/api/v1/documents');
    assert.deepEqual(config.params, { page: 2, size: 5 });
    return { data: documents };
  };

  assert.deepEqual(await documentsApi.getDocuments({ page: 2, size: 5 }), {
    items: documents,
    total: 2,
    page: 2,
    size: 5,
  });
});

test('documentsApi.updateDraft sends optimistic concurrency version to the backend', async () => {
  const conflict = Object.assign(new Error('version conflict'), { response: { status: 409 } });
  apiClient.put = async (url, body) => {
    assert.equal(url, '/api/v1/documents/doc-1/draft');
    assert.deepEqual(body, { content: '# updated', baseVersionNo: 7 });
    throw conflict;
  };

  await assert.rejects(
    documentsApi.updateDraft('doc-1', { content: '# updated', baseVersionNo: 7 }),
    (error) => error === conflict && error.response.status === 409,
  );
});

test('documentsApi.rollbackDocument creates the requested rollback through the backend', async () => {
  const rollback = { versionNo: 8, changeSource: 'ROLLBACK' };
  apiClient.post = async (url, body) => {
    assert.equal(url, '/api/v1/documents/doc-1/rollback');
    assert.deepEqual(body, { targetVersionNo: 3, reason: 'Restore approved content' });
    return { data: rollback };
  };

  assert.equal(await documentsApi.rollbackDocument('doc-1', {
    targetVersionNo: 3,
    reason: 'Restore approved content',
  }), rollback);
});

test('documentsApi starts and polls a repository analysis run through the backend', async () => {
  const queued = { runId: 'run-1', status: 'queued' };
  const completed = { id: 'run-1', status: 'completed', filesIndexed: 4, entitiesIndexed: 12 };
  apiClient.post = async (url, body) => {
    assert.equal(url, '/api/v1/repositories/repo-1/analysis-runs');
    assert.equal(body, undefined);
    return { data: queued };
  };
  apiClient.get = async (url) => {
    assert.equal(url, '/api/v1/analysis-runs/run-1');
    return { data: completed };
  };

  assert.equal(await documentsApi.startAnalysisRun('repo-1'), queued);
  assert.equal(await documentsApi.getAnalysisRun(queued.runId), completed);
});

test('documentsApi lists analysis runs filtered by repository', async () => {
  const runs = [{ id: 'run-1', status: 'completed' }];
  apiClient.get = async (url, config) => {
    assert.equal(url, '/api/v1/analysis-runs');
    assert.deepEqual(config.params, { repositoryId: 'repo-1' });
    return { data: runs };
  };

  assert.deepEqual(await documentsApi.getAnalysisRuns('repo-1'), runs);
});

test('Vite proxies analysis run polling to Integration Service', () => {
  assert.equal(viteConfig.server.proxy['/api/v1/analysis-runs'].target, 'http://localhost:8082');
});

test('documentsApi.generateDocument posts generate request and returns accepted job', async () => {
  const req = {
    scopeType: 'FILE',
    scopeReference: 'src/main.py',
    repositoryId: 'repo-1',
    templateId: 'tpl-1',
    commitSha: 'a'.repeat(40),
    codeEntityIds: ['id-1'],
    title: 'Test Doc',
    pathInRepo: 'docs/test.md'
  };
  const res = { jobId: 'job-1', status: 'pending', message: 'Task queued' };
  apiClient.post = async (url, body) => {
    assert.equal(url, '/api/v1/documents/generate');
    assert.deepEqual(body, req);
    return { data: res };
  };
  assert.deepEqual(await documentsApi.generateDocument(req), res);
});

test('documentsApi.getGenerationJob queries generation job by id', async () => {
  const job = {
    jobId: 'job-1',
    status: 'completed',
    resultDocumentId: 'doc-1',
    errorCode: null,
    errorMessage: null,
    retryCount: 0,
    nextRetryAt: null,
  };
  apiClient.get = async (url) => {
    assert.equal(url, '/api/v1/documents/generation-jobs/job-1');
    return { data: job };
  };
  assert.deepEqual(await documentsApi.getGenerationJob('job-1'), job);
});

test('documentsApi.getDocumentById fetches document detail with metadata', async () => {
  const doc = { id: 'doc-1', title: 'Test Doc', docStatus: 'DRAFT', currentVersionNo: 1 };
  apiClient.get = async (url) => {
    assert.equal(url, '/api/v1/documents/doc-1');
    return { data: doc };
  };
  assert.deepEqual(await documentsApi.getDocumentById('doc-1'), doc);
});

test('documentsApi.submitForReview submits draft for review', async () => {
  const res = { message: 'Đã nộp duyệt thành công' };
  apiClient.post = async (url) => {
    assert.equal(url, '/api/v1/documents/doc-1/submit');
    return { data: res };
  };
  assert.deepEqual(await documentsApi.submitForReview('doc-1'), res);
});

test('authApi.switchRole sends role switch request to users/me/switch-role', async () => {
  const userRes = { id: 'user-1', email: 'alice@example.com', roles: ['Staff'] };
  apiClient.post = async (url, body) => {
    assert.equal(url, '/api/v1/users/me/switch-role');
    assert.deepEqual(body, { role: 'Staff' });
    return { data: userRes };
  };
  assert.deepEqual(await authApi.switchRole('Staff'), userRes);
});

test('authApi.devLogin sends request to auth/dev-token', async () => {
  const tokenRes = { accessToken: 'jwt-token', tokenType: 'Bearer' };
  apiClient.post = async (url, body) => {
    assert.equal(url, '/api/v1/auth/dev-token');
    assert.deepEqual(body, { tenant: 'demo', email: 'staff1@example.com', roles: ['Staff'] });
    return { data: tokenRes };
  };
  assert.deepEqual(await authApi.devLogin('demo', 'staff1@example.com', ['Staff']), tokenRes);
});
