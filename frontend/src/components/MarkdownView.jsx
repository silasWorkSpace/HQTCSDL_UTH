import React, { useMemo } from 'react';
import { FileText, ExternalLink } from 'lucide-react';

/**
 * Parses inline markdown: bold, italic, strikethrough, inline code, and links.
 * Strictly sanitizes URLs to block javascript: schemes.
 */
function renderInlineMarkdown(text) {
  if (!text) return null;

  // Split by inline code first: `code`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const codeContent = part.slice(1, -1);
      return (
        <code
          key={pIdx}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.875em',
            backgroundColor: '#f1f5f9',
            color: '#0f172a',
            padding: '2px 5px',
            borderRadius: '4px',
            border: '1px solid #e2e8f0',
          }}
        >
          {codeContent}
        </code>
      );
    }

    // Process links: [label](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const elements = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(part)) !== null) {
      const preceding = part.substring(lastIndex, match.index);
      if (preceding) {
        elements.push(renderFormattedText(preceding, `${pIdx}-${lastIndex}`));
      }

      const label = match[1];
      const rawUrl = match[2].trim();
      const isSafeUrl = /^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('/') || rawUrl.startsWith('#');
      const safeUrl = isSafeUrl ? rawUrl : '#';
      const isExternal = /^https?:\/\//i.test(safeUrl);

      elements.push(
        <a
          key={`${pIdx}-${match.index}`}
          href={safeUrl}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          style={{
            color: '#2563eb',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            borderBottom: '1px dotted #93c5fd',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1d4ed8')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#2563eb')}
        >
          {label}
          {isExternal && <ExternalLink size={11} style={{ opacity: 0.7 }} />}
        </a>
      );
      lastIndex = linkRegex.lastIndex;
    }

    const trailing = part.substring(lastIndex);
    if (trailing) {
      elements.push(renderFormattedText(trailing, `${pIdx}-tail`));
    }

    return <React.Fragment key={pIdx}>{elements}</React.Fragment>;
  });
}

/**
 * Parses bold (**text**), italic (*text* or _text_), and strikethrough (~~text~~).
 */
function renderFormattedText(text, keyPrefix) {
  // Simple token parser for text styles
  const tokens = text.split(/(\*\*.*?\*\*|~~.*?~~|\*.*?\*)/g);
  return tokens.map((token, idx) => {
    const k = `${keyPrefix}-${idx}`;
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return <strong key={k}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('~~') && token.endsWith('~~') && token.length >= 4) {
      return <del key={k}>{token.slice(2, -2)}</del>;
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return <em key={k}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}

/**
 * MarkdownView Component
 * Renders structured Markdown with safety checks, typography styling,
 * code syntax background, responsive tables, and empty-state handling.
 *
 * @param {Object} props
 * @param {string} props.content - Raw markdown string to render
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {string} [props.emptyTitle='Chưa có nội dung'] - Title for empty state
 * @param {string} [props.emptyDescription='Tài liệu này hiện chưa có nội dung văn bản.'] - Description for empty state
 * @returns {React.ReactElement}
 */
export default function MarkdownView({
  content = '',
  className = '',
  emptyTitle = 'Chưa có nội dung',
  emptyDescription = 'Tài liệu này hiện chưa có nội dung văn bản.',
}) {
  const parsedNodes = useMemo(() => {
    if (!content || !content.trim()) return null;

    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const nodes = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        i++;
        continue;
      }

      // 1. Fenced Code Block: ```language
      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        nodes.push({
          type: 'code_block',
          lang,
          code: codeLines.join('\n'),
        });
        continue;
      }

      // 2. Blockquote: > text
      if (trimmed.startsWith('>')) {
        const quoteLines = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        nodes.push({
          type: 'blockquote',
          text: quoteLines.join(' '),
        });
        continue;
      }

      // 3. Headings: # H1, ## H2, etc.
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        nodes.push({
          type: 'heading',
          level: headingMatch[1].length,
          text: headingMatch[2],
        });
        i++;
        continue;
      }

      // 4. Tables: | header | header |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const parseRow = (row) =>
            row
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim());
          const headers = parseRow(tableLines[0]);
          const rows = tableLines.slice(2).map(parseRow); // skip separator row

          nodes.push({
            type: 'table',
            headers,
            rows,
          });
          continue;
        }
      }

      // 5. Unordered List: - item or * item
      if (/^[-*]\s+/.test(trimmed)) {
        const listItems = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^[-*]\s+/, ''));
          i++;
        }
        nodes.push({
          type: 'unordered_list',
          items: listItems,
        });
        continue;
      }

      // 6. Ordered List: 1. item
      if (/^\d+\.\s+/.test(trimmed)) {
        const listItems = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
          i++;
        }
        nodes.push({
          type: 'ordered_list',
          items: listItems,
        });
        continue;
      }

      // 7. Horizontal Rule: --- or ***
      if (/^(---|\*\*\*|___)$/.test(trimmed)) {
        nodes.push({ type: 'hr' });
        i++;
        continue;
      }

      // 8. Normal Paragraph
      const paragraphLines = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith('#') &&
        !lines[i].trim().startsWith('```') &&
        !lines[i].trim().startsWith('>') &&
        !lines[i].trim().startsWith('|') &&
        !/^[-*]\s+/.test(lines[i].trim()) &&
        !/^\d+\.\s+/.test(lines[i].trim())
      ) {
        paragraphLines.push(lines[i].trim());
        i++;
      }
      nodes.push({
        type: 'paragraph',
        text: paragraphLines.join(' '),
      });
    }

    return nodes;
  }, [content]);

  // Empty state rendering
  if (!parsedNodes || parsedNodes.length === 0) {
    return (
      <div
        className={`markdown-view-empty ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px dashed #cbd5e1',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            marginBottom: '12px',
          }}
        >
          <FileText size={24} />
        </div>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600, color: '#334155' }}>
          {emptyTitle}
        </h4>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '360px' }}>
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <article
      className={`markdown-view-content ${className}`}
      style={{
        lineHeight: 1.7,
        fontSize: '15px',
        color: '#1e293b',
        maxWidth: '100%',
      }}
    >
      {parsedNodes.map((node, index) => {
        switch (node.type) {
          case 'heading': {
            const headingStyles = {
              1: { fontSize: '24px', fontWeight: 700, margin: '28px 0 16px', borderBottom: '1px solid #e2e8f0', pb: '8px' },
              2: { fontSize: '20px', fontWeight: 600, margin: '24px 0 14px', borderBottom: '1px solid #f1f5f9', pb: '6px' },
              3: { fontSize: '17px', fontWeight: 600, margin: '20px 0 10px' },
              4: { fontSize: '15px', fontWeight: 600, margin: '16px 0 8px' },
              5: { fontSize: '14px', fontWeight: 600, margin: '14px 0 6px' },
              6: { fontSize: '13px', fontWeight: 600, margin: '12px 0 4px', color: '#64748b' },
            }[node.level] || { fontSize: '16px', fontWeight: 600, margin: '16px 0 8px' };

            const Tag = `h${node.level}`;
            return (
              <Tag
                key={index}
                style={{
                  ...headingStyles,
                  color: '#0f172a',
                  paddingBottom: headingStyles.pb || 0,
                }}
              >
                {renderInlineMarkdown(node.text)}
              </Tag>
            );
          }

          case 'paragraph':
            return (
              <p key={index} style={{ margin: '0 0 16px 0', color: '#334155' }}>
                {renderInlineMarkdown(node.text)}
              </p>
            );

          case 'code_block':
            return (
              <div
                key={index}
                style={{
                  margin: '16px 0',
                  borderRadius: '6px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  overflow: 'hidden',
                }}
              >
                {node.lang && (
                  <div
                    style={{
                      padding: '4px 12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#94a3b8',
                      backgroundColor: '#1e293b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #334155',
                    }}
                  >
                    {node.lang}
                  </div>
                )}
                <pre
                  style={{
                    margin: 0,
                    padding: '14px 16px',
                    overflowX: 'auto',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    color: '#f8fafc',
                  }}
                >
                  <code>{node.code}</code>
                </pre>
              </div>
            );

          case 'blockquote':
            return (
              <blockquote
                key={index}
                style={{
                  margin: '16px 0',
                  padding: '10px 16px',
                  borderLeft: '4px solid #3b82f6',
                  backgroundColor: '#eff6ff',
                  color: '#1e40af',
                  borderRadius: '0 6px 6px 0',
                  fontSize: '14px',
                }}
              >
                {renderInlineMarkdown(node.text)}
              </blockquote>
            );

          case 'unordered_list':
            return (
              <ul key={index} style={{ margin: '0 0 16px 0', paddingLeft: '24px', color: '#334155' }}>
                {node.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ marginBottom: '6px' }}>
                    {renderInlineMarkdown(item)}
                  </li>
                ))}
              </ul>
            );

          case 'ordered_list':
            return (
              <ol key={index} style={{ margin: '0 0 16px 0', paddingLeft: '24px', color: '#334155' }}>
                {node.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ marginBottom: '6px' }}>
                    {renderInlineMarkdown(item)}
                  </li>
                ))}
              </ol>
            );

          case 'table':
            return (
              <div
                key={index}
                style={{
                  margin: '16px 0',
                  overflowX: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {node.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          style={{
                            padding: '10px 14px',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: '#334155',
                          }}
                        >
                          {renderInlineMarkdown(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {node.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        style={{
                          borderBottom: rIdx < node.rows.length - 1 ? '1px solid #f1f5f9' : 'none',
                          backgroundColor: rIdx % 2 === 1 ? '#fafafa' : '#ffffff',
                        }}
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ padding: '8px 14px', color: '#475569' }}>
                            {renderInlineMarkdown(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'hr':
            return (
              <hr
                key={index}
                style={{
                  border: 'none',
                  borderTop: '1px solid #e2e8f0',
                  margin: '24px 0',
                }}
              />
            );

          default:
            return null;
        }
      })}
    </article>
  );
}
