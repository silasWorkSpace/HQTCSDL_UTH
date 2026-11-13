import test from 'node:test';
import assert from 'node:assert';
import { documentsApi } from '../src/features/documents/api.js';
import { templatesApi } from '../src/features/templates/api.js';

test('documentsApi.getDocuments returns normalized pagination wrapper', async () => {
  const result = await documentsApi.getDocuments({ page: 0, size: 10 });
  assert.ok(Array.isArray(result.items));
  assert.ok(typeof result.total === 'number');
  assert.strictEqual(result.page, 0);
  assert.strictEqual(result.size, 10);
});

test('documentsApi.updateDraft detects 409 conflict when baseVersionNo differs', async () => {
  const docs = await documentsApi.getDocuments();
  const targetDoc = docs.items[0];

  // Pass an obsolete baseVersionNo (e.g. 999)
  await assert.rejects(
    async () => {
      await documentsApi.updateDraft(targetDoc.id, {
        content: 'New draft edits',
        baseVersionNo: 999,
      });
    },
    (err) => {
      assert.strictEqual(err.response?.status, 409);
      return true;
    }
  );
});

test('documentsApi.rollbackDocument creates new version and checks redacted', async () => {
  // Test rollback on valid doc
  const docs = await documentsApi.getDocuments();
  const validDoc = docs.items[0];

  const rollbackRes = await documentsApi.rollbackDocument(validDoc.id, {
    targetVersionNo: 1,
    reason: 'Phục hồi về phiên bản ban đầu',
  });

  assert.ok(rollbackRes.versionNo > 1);
  assert.strictEqual(rollbackRes.changeSource, 'ROLLBACK');

  // Test rollback on redacted doc (should throw 409)
  const redactedDoc = docs.items.find((d) => d.id === 'd1000000-0000-0000-0000-000000000006');
  if (redactedDoc) {
    await assert.rejects(
      async () => {
        await documentsApi.rollbackDocument(redactedDoc.id, {
          targetVersionNo: 1,
          reason: 'Test redacted rollback',
        });
      },
      (err) => {
        assert.strictEqual(err.response?.status, 409);
        return true;
      }
    );
  }
});

test('documentsApi.generateDocument enqueues AI job and returns 202', async () => {
  const res = await documentsApi.generateDocument({
    scopeType: 'FILE',
    scopeReference: 'src/core/auth.js',
    repositoryId: '11111111-1111-1111-1111-111111111111',
    templateId: 't1000000-0000-0000-0000-000000000001',
    title: 'Auth Spec',
    targetPath: 'docs/auth.md',
  });

  assert.ok(res.jobId);
  assert.strictEqual(res.status, 'QUEUED');
});

test('templatesApi.getTemplates contains standard seed templates', async () => {
  const tpls = await templatesApi.getTemplates();
  assert.ok(tpls.length >= 5);

  const names = tpls.map((t) => t.name);
  assert.ok(names.includes('API Reference'));
  assert.ok(names.includes('README'));
  assert.ok(names.includes('Module Guide'));
  assert.ok(names.includes('Onboarding Guide'));
  assert.ok(names.includes('ADR'));
});

test('templatesApi.createTemplate rejects duplicate names with 409', async () => {
  await assert.rejects(
    async () => {
      await templatesApi.createTemplate({
        name: 'README', // already exists
        docType: 'README',
        sections: { sections: [{ key: 'intro', title: 'Intro' }] },
      });
    },
    (err) => {
      assert.strictEqual(err.response?.status, 409);
      return true;
    }
  );
});
