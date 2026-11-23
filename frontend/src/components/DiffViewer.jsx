import React, { useState, useMemo } from 'react';
import {
  Plus,
  Minus,
  Columns,
  AlignJustify,
  ChevronsUpDown,
  FileDiff,
} from 'lucide-react';

/**
 * Computes a standard Myers/LCS diff between two multi-line strings.
 * Used as an autonomous fallback when backend pre-computed diff lines are not available.
 *
 * @param {string} oldText
 * @param {string} newText
 * @returns {Array<{ op: 'EQUAL'|'ADD'|'DELETE', oldLineNo?: number, newLineNo?: number, text: string }>}
 */
function computeClientDiff(oldText = '', newText = '') {
  const oldLines = oldText ? oldText.replace(/\r\n/g, '\n').split('\n') : [];
  const newLines = newText ? newText.replace(/\r\n/g, '\n').split('\n') : [];

  const n = oldLines.length;
  const m = newLines.length;

  // Build LCS matrix
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

  // Backtrack to build diff stream
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

/**
 * Normalizes input lines from either:
 * - Structured array of { op: 'EQUAL'|'ADD'|'DELETE', text }
 * - Backend DiffUtils string lines (e.g. "[InsertDelta, position: ...]" or unified diff format "+", "-", " ")
 * - Fallback to computing diff from oldText and newText.
 */
function normalizeDiffInput({ lines, oldText, newText }) {
  if (Array.isArray(lines) && lines.length > 0) {
    let curOld = 1;
    let curNew = 1;

    return lines.map((item) => {
      // If item is already structured: { op, text }
      if (typeof item === 'object' && item !== null && item.op) {
        const op = item.op.toUpperCase();
        const oldLineNo = op === 'ADD' ? undefined : curOld++;
        const newLineNo = op === 'DELETE' ? undefined : curNew++;
        return {
          op,
          text: item.text ?? '',
          oldLineNo,
          newLineNo,
        };
      }

      // If item is a string
      const str = String(item);
      if (str.startsWith('+')) {
        return {
          op: 'ADD',
          text: str.substring(1),
          newLineNo: curNew++,
        };
      }
      if (str.startsWith('-')) {
        return {
          op: 'DELETE',
          text: str.substring(1),
          oldLineNo: curOld++,
        };
      }
      // String representation of Delta or unchanged line
      return {
        op: 'EQUAL',
        text: str.startsWith(' ') ? str.substring(1) : str,
        oldLineNo: curOld++,
        newLineNo: curNew++,
      };
    });
  }

  // Fallback to client-side diff
  return computeClientDiff(oldText, newText);
}

/**
 * Groups diff items, collapsing long stretches of unchanged (EQUAL) lines.
 */
function groupDiffLines(items, collapseThreshold = 8) {
  const groups = [];
  let currentEqualBlock = [];

  const flushEqual = () => {
    if (currentEqualBlock.length > collapseThreshold) {
      // Keep first 2 and last 2 lines visible, collapse middle
      groups.push({
        type: 'items',
        items: currentEqualBlock.slice(0, 2),
      });
      groups.push({
        type: 'collapsed',
        count: currentEqualBlock.length - 4,
        hiddenItems: currentEqualBlock.slice(2, currentEqualBlock.length - 2),
      });
      groups.push({
        type: 'items',
        items: currentEqualBlock.slice(currentEqualBlock.length - 2),
      });
    } else if (currentEqualBlock.length > 0) {
      groups.push({ type: 'items', items: currentEqualBlock });
    }
    currentEqualBlock = [];
  };

  for (const item of items) {
    if (item.op === 'EQUAL') {
      currentEqualBlock.push(item);
    } else {
      flushEqual();
      groups.push({ type: 'items', items: [item] });
    }
  }
  flushEqual();

  return groups;
}

/**
 * DiffViewer Component (VER-04)
 * High-performance, side-by-side or unified visual difference viewer.
 *
 * @param {Object} props
 * @param {Array<{op: 'EQUAL'|'ADD'|'DELETE', text: string}>|Array<string>} [props.lines] - Precomputed diff lines
 * @param {string} [props.oldText=''] - Original content string (used when lines is not provided)
 * @param {string} [props.newText=''] - Modified content string (used when lines is not provided)
 * @param {string} [props.fromLabel='Phiên bản cũ'] - Header label for the base version
 * @param {string} [props.toLabel='Phiên bản mới'] - Header label for the target version
 * @param {'split'|'unified'} [props.mode='split'] - Initial display mode
 * @param {'vi'|'en'} [props.lang='vi'] - Display language for UI labels
 * @param {string} [props.className=''] - Additional class name
 * @returns {React.ReactElement}
 */
export default function DiffViewer({
  lines,
  oldText = '',
  newText = '',
  fromLabel = 'Phiên bản cũ',
  toLabel = 'Phiên bản mới',
  mode: initialMode = 'split',
  lang = 'vi',
  className = '',
}) {
  const [viewMode, setViewMode] = useState(initialMode);
  const [expandedBlocks, setExpandedBlocks] = useState(new Set());

  const diffItems = useMemo(
    () => normalizeDiffInput({ lines, oldText, newText }),
    [lines, oldText, newText]
  );

  const { additions, deletions } = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const item of diffItems) {
      if (item.op === 'ADD') add++;
      if (item.op === 'DELETE') del++;
    }
    return { additions: add, deletions: del };
  }, [diffItems]);

  const groups = useMemo(() => groupDiffLines(diffItems), [diffItems]);

  const toggleExpand = (groupIndex) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(groupIndex)) {
        next.delete(groupIndex);
      } else {
        next.add(groupIndex);
      }
      return next;
    });
  };

  const labels = {
    vi: {
      split: 'Hai cột',
      unified: 'Xen kẽ',
      changes: 'thay đổi',
      noChanges: 'Hai phiên bản có nội dung hoàn toàn giống nhau',
      expandLines: (count) => `Mở rộng ${count} dòng không đổi...`,
      additions: 'dòng thêm',
      deletions: 'dòng xóa',
    },
    en: {
      split: 'Side-by-side',
      unified: 'Unified',
      changes: 'changes',
      noChanges: 'Both versions have identical content',
      expandLines: (count) => `Expand ${count} unchanged lines...`,
      additions: 'additions',
      deletions: 'deletions',
    },
  }[lang] || {
    split: 'Hai cột',
    unified: 'Xen kẽ',
    changes: 'thay đổi',
    noChanges: 'Hai phiên bản có nội dung hoàn toàn giống nhau',
    expandLines: (count) => `Mở rộng ${count} dòng không đổi...`,
    additions: 'dòng thêm',
    deletions: 'dòng xóa',
  };

  if (diffItems.length === 0) {
    return (
      <div
        className={`diff-viewer-empty ${className}`}
        style={{
          padding: '36px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <FileDiff size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>{labels.noChanges}</p>
      </div>
    );
  }

  return (
    <div
      className={`diff-viewer-container ${className}`}
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Diff Toolbar & Metric Headers */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: '#dcfce7',
                color: '#166534',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              <Plus size={12} />
              {additions}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              <Minus size={12} />
              {deletions}
            </span>
          </div>

          <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>
            {fromLabel} <span style={{ color: '#94a3b8' }}>→</span> {toLabel}
          </span>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              border: 'none',
              backgroundColor: viewMode === 'split' ? '#3b82f6' : '#ffffff',
              color: viewMode === 'split' ? '#ffffff' : '#475569',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Columns size={13} />
            {labels.split}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('unified')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              border: 'none',
              borderLeft: '1px solid #cbd5e1',
              backgroundColor: viewMode === 'unified' ? '#3b82f6' : '#ffffff',
              color: viewMode === 'unified' ? '#ffffff' : '#475569',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <AlignJustify size={13} />
            {labels.unified}
          </button>
        </div>
      </div>

      {/* Diff Table Body */}
      <div style={{ overflowX: 'auto', maxHeight: '580px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', lineHeight: 1.5 }}>
          <tbody>
            {groups.map((group, gIdx) => {
              if (group.type === 'collapsed') {
                const isExpanded = expandedBlocks.has(gIdx);
                if (isExpanded) {
                  return group.hiddenItems.map((item, idx) => (
                    <DiffRow key={`exp-${gIdx}-${idx}`} item={item} mode={viewMode} />
                  ));
                }

                return (
                  <tr key={`col-${gIdx}`} style={{ backgroundColor: '#f1f5f9' }}>
                    <td
                      colSpan={viewMode === 'split' ? 4 : 3}
                      style={{
                        padding: '6px 14px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontSize: '12px',
                        borderTop: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(gIdx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 500,
                        }}
                      >
                        <ChevronsUpDown size={13} />
                        {labels.expandLines(group.count)}
                      </button>
                    </td>
                  </tr>
                );
              }

              return group.items.map((item, idx) => (
                <DiffRow key={`itm-${gIdx}-${idx}`} item={item} mode={viewMode} />
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Individual row renderer supporting both split and unified view modes.
 */
function DiffRow({ item, mode }) {
  const isAdd = item.op === 'ADD';
  const isDel = item.op === 'DELETE';

  const rowBg = isAdd ? '#f0fdf4' : isDel ? '#fef2f2' : '#ffffff';
  const textBg = isAdd ? '#dcfce7' : isDel ? '#fee2e2' : 'transparent';
  const prefixSign = isAdd ? '+' : isDel ? '−' : ' ';
  const prefixColor = isAdd ? '#15803d' : isDel ? '#b91c1c' : '#94a3b8';

  if (mode === 'unified') {
    return (
      <tr style={{ backgroundColor: rowBg, borderBottom: '1px solid #f1f5f9' }}>
        {/* Old Line Number */}
        <td
          style={{
            width: '40px',
            textAlign: 'right',
            padding: '2px 8px',
            color: '#94a3b8',
            userSelect: 'none',
            borderRight: '1px solid #f1f5f9',
          }}
        >
          {item.oldLineNo || ''}
        </td>

        {/* New Line Number */}
        <td
          style={{
            width: '40px',
            textAlign: 'right',
            padding: '2px 8px',
            color: '#94a3b8',
            userSelect: 'none',
            borderRight: '1px solid #e2e8f0',
          }}
        >
          {item.newLineNo || ''}
        </td>

        {/* Content with op marker */}
        <td style={{ padding: '2px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              fontWeight: 700,
              color: prefixColor,
              userSelect: 'none',
            }}
          >
            {prefixSign}
          </span>
          <span style={{ backgroundColor: textBg }}>{item.text || '\u00A0'}</span>
        </td>
      </tr>
    );
  }

  // Split view mode: Render side-by-side
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      {/* LEFT: Old side */}
      <td
        style={{
          width: '40px',
          textAlign: 'right',
          padding: '2px 8px',
          color: '#94a3b8',
          userSelect: 'none',
          backgroundColor: isDel ? '#fef2f2' : '#fafafa',
          borderRight: '1px solid #e2e8f0',
        }}
      >
        {isDel || item.op === 'EQUAL' ? item.oldLineNo : ''}
      </td>
      <td
        style={{
          width: '50%',
          padding: '2px 10px',
          backgroundColor: isDel ? '#fef2f2' : '#ffffff',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          borderRight: '2px solid #cbd5e1',
        }}
      >
        {isDel ? (
          <>
            <span style={{ display: 'inline-block', width: '14px', fontWeight: 700, color: '#b91c1c', userSelect: 'none' }}>
              −
            </span>
            <span style={{ backgroundColor: '#fee2e2' }}>{item.text || '\u00A0'}</span>
          </>
        ) : item.op === 'EQUAL' ? (
          <span style={{ color: '#334155' }}>{item.text || '\u00A0'}</span>
        ) : (
          '\u00A0'
        )}
      </td>

      {/* RIGHT: New side */}
      <td
        style={{
          width: '40px',
          textAlign: 'right',
          padding: '2px 8px',
          color: '#94a3b8',
          userSelect: 'none',
          backgroundColor: isAdd ? '#f0fdf4' : '#fafafa',
          borderRight: '1px solid #e2e8f0',
        }}
      >
        {isAdd || item.op === 'EQUAL' ? item.newLineNo : ''}
      </td>
      <td
        style={{
          width: '50%',
          padding: '2px 10px',
          backgroundColor: isAdd ? '#f0fdf4' : '#ffffff',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {isAdd ? (
          <>
            <span style={{ display: 'inline-block', width: '14px', fontWeight: 700, color: '#15803d', userSelect: 'none' }}>
              +
            </span>
            <span style={{ backgroundColor: '#dcfce7' }}>{item.text || '\u00A0'}</span>
          </>
        ) : item.op === 'EQUAL' ? (
          <span style={{ color: '#334155' }}>{item.text || '\u00A0'}</span>
        ) : (
          '\u00A0'
        )}
      </td>
    </tr>
  );
}
