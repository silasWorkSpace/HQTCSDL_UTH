// Bốn mức drift (NFR-USAB-03): màu luôn đi kèm nhãn chữ và biểu tượng, không chỉ dựa vào màu.
// Cặp màu chữ / nền đều đạt tỉ lệ tương phản tối thiểu 4.5:1.
export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical']

export const SEVERITY_STYLE = {
  Low: { color: '#237804', background: '#f6ffed', border: '#b7eb8f' },
  Medium: { color: '#7c5200', background: '#fffbe6', border: '#ffe58f' },
  High: { color: '#ad4e00', background: '#fff7e6', border: '#ffd591' },
  Critical: { color: '#a8071a', background: '#fff1f0', border: '#ffa39e' },
}

/** 0 (Low) .. 3 (Critical); -1 nếu không hợp lệ. */
export function severityRank(severity) {
  return SEVERITIES.indexOf(severity)
}

/** Mức cao nhất trong danh sách, null nếu không có mức hợp lệ nào. */
export function maxSeverity(list) {
  let best = null
  for (const s of list ?? []) {
    if (severityRank(s) > severityRank(best)) best = s
  }
  return best
}
