import test from 'node:test';
import assert from 'node:assert';

function computeClientDiff(oldText = '', newText = '') {
  const oldLines = oldText ? oldText.replace(/\r\n/g, '\n').split('\n') : [];
  const newLines = newText ? newText.replace(/\r\n/g, '\n').split('\n') : [];

  const n = oldLines.length;
  const m = newLines.length;

  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        op: 'EQUAL',
        oldLineNo: i,
        newLineNo: j,
        text: oldLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        op: 'ADD',
        newLineNo: j,
        text: newLines[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({
        op: 'DELETE',
        oldLineNo: i,
        text: oldLines[i - 1],
      });
      i--;
    }
  }

  return result;
}

test('Diff computation detects line addition (+)', () => {
  const oldText = 'Line 1\nLine 2';
  const newText = 'Line 1\nInserted Line\nLine 2';
  const diff = computeClientDiff(oldText, newText);

  assert.strictEqual(diff.length, 3);
  assert.strictEqual(diff[0].op, 'EQUAL');
  assert.strictEqual(diff[1].op, 'ADD');
  assert.strictEqual(diff[1].text, 'Inserted Line');
  assert.strictEqual(diff[2].op, 'EQUAL');
});

test('Diff computation detects line deletion (-)', () => {
  const oldText = 'Line 1\nRemoved Line\nLine 2';
  const newText = 'Line 1\nLine 2';
  const diff = computeClientDiff(oldText, newText);

  assert.strictEqual(diff.length, 3);
  assert.strictEqual(diff[0].op, 'EQUAL');
  assert.strictEqual(diff[1].op, 'DELETE');
  assert.strictEqual(diff[1].text, 'Removed Line');
  assert.strictEqual(diff[2].op, 'EQUAL');
});

test('Diff computation handles identical and empty texts', () => {
  const identical = computeClientDiff('Same content', 'Same content');
  assert.strictEqual(identical.length, 1);
  assert.strictEqual(identical[0].op, 'EQUAL');

  const empty = computeClientDiff('', '');
  assert.strictEqual(empty.length, 0);
});
