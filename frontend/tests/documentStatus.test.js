import test from 'node:test';
import assert from 'node:assert';
import {
  DOCUMENT_STATUS,
  PUBLISH_STATUS,
  PR_STATUS,
  getDocStatusMeta,
  getPublishStatusMeta,
  getPrStatusMeta,
} from '../src/constants/documentStatus.js';

test('DOCUMENT_STATUS contains all 11 standardized statuses', () => {
  const expectedStatuses = [
    'DRAFT',
    'PENDING_DEVELOPER_ACTION',
    'IN_REVIEW_STAFF',
    'IN_REVIEW_MANAGER',
    'CHANGES_REQUESTED',
    'APPROVED',
    'PENDING_MERGE',
    'PUBLISHED',
    'REJECTED',
    'DISMISSED',
    'SUPERSEDED',
  ];

  assert.strictEqual(Object.keys(DOCUMENT_STATUS).length, 11);
  for (const status of expectedStatuses) {
    assert.ok(DOCUMENT_STATUS[status], `Missing status: ${status}`);
    assert.ok(DOCUMENT_STATUS[status].labelVi, `Missing labelVi for ${status}`);
    assert.ok(DOCUMENT_STATUS[status].labelEn, `Missing labelEn for ${status}`);
    assert.ok(DOCUMENT_STATUS[status].tone, `Missing tone for ${status}`);
  }
});

test('PUBLISH_STATUS contains all 4 storage states', () => {
  const expected = ['NOT_PUBLISHED', 'FAILED', 'COMMITTED_TO_DOCS_BRANCH', 'IN_TARGET_BRANCH'];
  assert.strictEqual(Object.keys(PUBLISH_STATUS).length, 4);
  for (const key of expected) {
    assert.ok(PUBLISH_STATUS[key]);
  }
});

test('PR_STATUS contains all 4 Pull Request states', () => {
  const expected = ['NONE', 'PENDING_MERGE', 'CLOSED_UNMERGED', 'MERGED'];
  assert.strictEqual(Object.keys(PR_STATUS).length, 4);
  for (const key of expected) {
    assert.ok(PR_STATUS[key]);
  }
});

test('Status helper functions handle unknown values gracefully without crashing', () => {
  const unknownDoc = getDocStatusMeta('RANDOM_CUSTOM_STATUS', 'vi');
  assert.strictEqual(unknownDoc.key, 'RANDOM_CUSTOM_STATUS');
  assert.strictEqual(unknownDoc.tone, 'neutral');

  const unknownPub = getPublishStatusMeta('MYSTERY_STATUS', 'en');
  assert.strictEqual(unknownPub.key, 'MYSTERY_STATUS');
  assert.strictEqual(unknownPub.tone, 'neutral');

  const unknownPr = getPrStatusMeta('UNKNOWN_PR', 'vi');
  assert.strictEqual(unknownPr.key, 'UNKNOWN_PR');
  assert.strictEqual(unknownPr.tone, 'neutral');
});
