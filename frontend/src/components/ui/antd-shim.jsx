import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  X,
  FileQuestion,
  ChevronDown,
} from 'lucide-react';

/* -------------------------------------------------------------
   Typography
------------------------------------------------------------- */
export const Typography = {
  Title: ({ level = 4, children, style = {}, className = '' }) => {
    const Tag = `h${Math.min(6, Math.max(1, level))}`;
    const fontSizes = { 1: '28px', 2: '24px', 3: '20px', 4: '16px', 5: '14px', 6: '12px' };
    return (
      <Tag
        className={className}
        style={{
          margin: '0 0 8px 0',
          fontWeight: 600,
          fontSize: fontSizes[level] || '16px',
          color: 'var(--ld-text, #111827)',
          ...style,
        }}
      >
        {children}
      </Tag>
    );
  },
  Text: ({ type, children, style = {}, className = '', strong = false }) => {
    const colorMap = {
      secondary: '#6b7280',
      danger: '#dc2626',
      warning: '#d97706',
      success: '#16a34a',
    };
    return (
      <span
        className={className}
        style={{
          color: colorMap[type] || 'inherit',
          fontWeight: strong ? 600 : 'inherit',
          ...style,
        }}
      >
        {children}
      </span>
    );
  },
  Paragraph: ({ children, style = {}, className = '' }) => (
    <p
      className={className}
      style={{
        margin: '0 0 12px 0',
        lineHeight: 1.5,
        color: 'var(--ld-text, #111827)',
        ...style,
      }}
    >
      {children}
    </p>
  ),
};

/* -------------------------------------------------------------
   Button
------------------------------------------------------------- */
export function Button({
  type = 'default',
  size = 'middle',
  danger = false,
  disabled = false,
  loading = false,
  onClick,
  children,
  icon,
  style = {},
  className = '',
}) {
  const isPrimary = type === 'primary';
  const isLink = type === 'link';
  const isText = type === 'text';

  const padding = size === 'small' ? '4px 10px' : size === 'large' ? '10px 20px' : '6px 14px';
  const fontSize = size === 'small' ? '12px' : size === 'large' ? '15px' : '13px';

  let bg = '#ffffff';
  let color = 'var(--ld-text, #374151)';
  let border = '1px solid #d1d5db';

  if (isPrimary) {
    bg = danger ? '#dc2626' : 'var(--ld-primary, #2563eb)';
    color = '#ffffff';
    border = `1px solid ${bg}`;
  } else if (danger) {
    color = '#dc2626';
    border = '1px solid #fca5a5';
  } else if (isLink || isText) {
    bg = 'transparent';
    border = 'none';
    color = danger ? '#dc2626' : 'var(--ld-primary, #2563eb)';
  }

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding,
        fontSize,
        fontWeight: 500,
        borderRadius: '6px',
        background: bg,
        color,
        border,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s ease',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------
   Tag
------------------------------------------------------------- */
export function Tag({ color, children, style = {}, className = '' }) {
  const isPresetColor = ['blue', 'green', 'red', 'orange', 'gold'].includes(color);
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        fontSize: '12px',
        fontWeight: 500,
        borderRadius: '4px',
        backgroundColor: isPresetColor ? `var(--ld-${color}-bg, #eff6ff)` : '#f3f4f6',
        color: isPresetColor ? `var(--ld-${color}-text, #1d4ed8)` : '#374151',
        border: '1px solid #e5e7eb',
        lineHeight: '18px',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------
   Card
------------------------------------------------------------- */
export function Card({ title, extra, children, size = 'default', style = {}, className = '' }) {
  const padding = size === 'small' ? '12px' : '18px';
  return (
    <div
      className={className}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--ld-border, #e5e7eb)',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            padding: `${padding} ${padding} 8px ${padding}`,
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          <div>{title}</div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div style={{ padding }}>{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------
   Space
------------------------------------------------------------- */
export function Space({
  direction = 'horizontal',
  size = 8,
  wrap = false,
  children,
  style = {},
  className = '',
}) {
  const isVertical = direction === 'vertical';
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        gap: typeof size === 'number' ? `${size}px` : size,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        alignItems: isVertical ? 'stretch' : 'center',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------
   Tabs
------------------------------------------------------------- */
export function Tabs({ items = [], activeKey, onChange, defaultActiveKey, style = {} }) {
  const [current, setCurrent] = useState(activeKey || defaultActiveKey || items[0]?.key);
  const active = activeKey !== undefined ? activeKey : current;

  const handleSelect = (key) => {
    setCurrent(key);
    onChange?.(key);
  };

  const activeItem = items.find((it) => it.key === active) || items[0];

  return (
    <div style={{ width: '100%', ...style }}>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '16px',
        }}
      >
        {items.map((item) => {
          const isSelected = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelect(item.key)}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: isSelected ? 600 : 500,
                color: isSelected ? 'var(--ld-primary, #2563eb)' : '#6b7280',
                border: 'none',
                background: 'none',
                borderBottom: isSelected ? '2px solid var(--ld-primary, #2563eb)' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-1px',
                transition: 'all 0.15s ease',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div>{activeItem?.children}</div>
    </div>
  );
}

/* -------------------------------------------------------------
   Table
------------------------------------------------------------- */
export function Table({
  columns = [],
  dataSource = [],
  rowKey = 'id',
  size = 'middle',
  pagination,
  locale = {},
  style = {},
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = pagination?.pageSize || 10;
  const hideOnSinglePage = pagination?.hideOnSinglePage ?? true;

  const total = dataSource.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedData = pagination === false
    ? dataSource
    : dataSource.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getKey = (row, idx) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? idx);

  return (
    <div style={{ width: '100%', overflowX: 'auto', ...style }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: size === 'small' ? '12px' : '13px',
          textAlign: 'left',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            {columns.map((col, idx) => (
              <th
                key={col.key || col.dataIndex || idx}
                style={{
                  padding: size === 'small' ? '8px 10px' : '10px 14px',
                  fontWeight: 600,
                  color: '#4b5563',
                }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '28px', textAlign: 'center', color: '#9ca3af' }}>
                {locale.emptyText || 'Không có dữ liệu'}
              </td>
            </tr>
          ) : (
            paginatedData.map((row, rIdx) => (
              <tr
                key={getKey(row, rIdx)}
                style={{
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'background 0.1s ease',
                }}
              >
                {columns.map((col, cIdx) => {
                  const val = col.dataIndex ? row[col.dataIndex] : undefined;
                  const rendered = col.render ? col.render(val, row, rIdx) : val;
                  return (
                    <td
                      key={col.key || col.dataIndex || cIdx}
                      style={{ padding: size === 'small' ? '8px 10px' : '10px 14px', color: '#1f2937' }}
                    >
                      {rendered}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {pagination !== false && totalPages > 1 && !hideOnSinglePage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '12px' }}>
          <Button
            size="small"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Trang trước
          </Button>
          <span style={{ fontSize: '12px', alignSelf: 'center', color: '#6b7280' }}>
            {currentPage} / {totalPages}
          </span>
          <Button
            size="small"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Trang sau
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------
   Modal
------------------------------------------------------------- */
export function Modal({ open, title, onCancel, onOk, okText = 'Xác nhận', cancelText = 'Hủy', footer, children }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          width: '520px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: 600,
            fontSize: '16px',
          }}
        >
          <div>{title}</div>
          <button
            type="button"
            onClick={onCancel}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto' }}>{children}</div>
        {footer !== null && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            {footer ? (
              footer
            ) : (
              <>
                <Button onClick={onCancel}>{cancelText}</Button>
                <Button type="primary" onClick={onOk}>
                  {okText}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   Drawer
------------------------------------------------------------- */
export function Drawer({ open, title, onClose, width = 640, extra, children }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width,
          maxWidth: '90vw',
          height: '100%',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '16px' }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {extra}
            <button
              type="button"
              onClick={onClose}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   Input & TextArea
------------------------------------------------------------- */
export function Input({
  value,
  onChange,
  placeholder,
  disabled = false,
  style = {},
  className = '',
  ...props
}) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      style={{
        width: '100%',
        padding: '6px 12px',
        fontSize: '13px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        backgroundColor: disabled ? '#f3f4f6' : '#ffffff',
        outline: 'none',
        ...style,
      }}
      {...props}
    />
  );
}

Input.TextArea = function TextArea({
  rows = 4,
  value,
  onChange,
  placeholder,
  disabled = false,
  style = {},
  className = '',
  ...props
}) {
  return (
    <textarea
      rows={rows}
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      style={{
        width: '100%',
        padding: '8px 12px',
        fontSize: '13px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        backgroundColor: disabled ? '#f3f4f6' : '#ffffff',
        outline: 'none',
        resize: 'vertical',
        ...style,
      }}
      {...props}
    />
  );
};

/* -------------------------------------------------------------
   Radio & Radio.Group
------------------------------------------------------------- */
export function Radio({ value, checked, onChange, children, style = {} }) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        cursor: 'pointer',
        ...style,
      }}
    >
      <input
        type="radio"
        value={value}
        checked={checked}
        onChange={onChange}
        style={{ cursor: 'pointer' }}
      />
      {children}
    </label>
  );
}

Radio.Group = function RadioGroup({ value, onChange, options = [], children, style = {} }) {
  if (options.length > 0) {
    return (
      <div style={{ display: 'flex', gap: '16px', ...style }}>
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const label = typeof opt === 'object' ? opt.label : opt;
          return (
            <Radio
              key={val}
              value={val}
              checked={value === val}
              onChange={() => onChange?.({ target: { value: val } })}
            >
              {label}
            </Radio>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '16px', ...style }}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, {
          checked: child.props.value === value,
          onChange: () => onChange?.({ target: { value: child.props.value } }),
        });
      })}
    </div>
  );
};

/* -------------------------------------------------------------
   Select
------------------------------------------------------------- */
export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Chọn...',
  style = {},
  allowClear = false,
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        padding: '6px 10px',
        fontSize: '13px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        backgroundColor: '#ffffff',
        outline: 'none',
        cursor: 'pointer',
        ...style,
      }}
    >
      {allowClear && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/* -------------------------------------------------------------
   Segmented
------------------------------------------------------------- */
export function Segmented({ options = [], value, onChange, style = {} }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        backgroundColor: '#f3f4f6',
        padding: '3px',
        borderRadius: '6px',
        gap: '2px',
        ...style,
      }}
    >
      {options.map((opt) => {
        const val = typeof opt === 'object' ? opt.value : opt;
        const label = typeof opt === 'object' ? opt.label : opt;
        const isSelected = val === value;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange?.(val)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: isSelected ? 600 : 400,
              border: 'none',
              borderRadius: '4px',
              backgroundColor: isSelected ? '#ffffff' : 'transparent',
              color: isSelected ? 'var(--ld-primary, #2563eb)' : '#4b5563',
              boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.1s ease',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------
   Progress
------------------------------------------------------------- */
export function Progress({ percent = 0, size = 'default', style = {} }) {
  const height = size === 'small' ? '4px' : '8px';
  const validPercent = Math.min(100, Math.max(0, percent));
  return (
    <div
      style={{
        width: '100%',
        height,
        backgroundColor: '#e5e7eb',
        borderRadius: '999px',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          width: `${validPercent}%`,
          height: '100%',
          backgroundColor: validPercent > 80 ? '#16a34a' : validPercent > 50 ? '#2563eb' : '#d97706',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------
   Skeleton
------------------------------------------------------------- */
export function Skeleton({ active = true, paragraph = { rows: 3 } }) {
  const rows = paragraph?.rows || 3;
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '18px',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            opacity: active ? 0.7 : 1,
            width: i === 0 ? '60%' : i === rows - 1 ? '40%' : '100%',
            animation: active ? 'pulse 1.5s infinite ease-in-out' : 'none',
          }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------
   Empty
------------------------------------------------------------- */
export function Empty({ description = 'Không có dữ liệu', image, style = {} }) {
  return (
    <div
      style={{
        padding: '32px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
        fontSize: '13px',
        ...style,
      }}
    >
      <FileQuestion size={40} strokeWidth={1.5} style={{ marginBottom: '10px', opacity: 0.5 }} />
      <div>{description}</div>
    </div>
  );
}
Empty.PRESENTED_IMAGE_SIMPLE = true;

/* -------------------------------------------------------------
   Result
------------------------------------------------------------- */
export function Result({ status = 'info', title, subTitle, extra }) {
  const isError = status === 'error';
  return (
    <div
      style={{
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      {isError ? (
        <AlertCircle size={48} color="#dc2626" style={{ marginBottom: '16px' }} />
      ) : (
        <CheckCircle size={48} color="#16a34a" style={{ marginBottom: '16px' }} />
      )}
      <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
        {title}
      </div>
      {subTitle && (
        <div style={{ fontSize: '14px', color: '#6b7280', maxWidth: '480px', marginBottom: '20px' }}>
          {subTitle}
        </div>
      )}
      {extra && <div>{extra}</div>}
    </div>
  );
}

/* -------------------------------------------------------------
   Alert
------------------------------------------------------------- */
export function Alert({ type = 'info', message, description, showIcon = false, style = {} }) {
  const configs = {
    info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: <Info size={18} /> },
    warning: { bg: '#fffbeb', border: '#fde68a', color: '#b45309', icon: <AlertTriangle size={18} /> },
    error: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: <AlertCircle size={18} /> },
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: <CheckCircle size={18} /> },
  };
  const conf = configs[type] || configs.info;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 14px',
        backgroundColor: conf.bg,
        border: `1px solid ${conf.border}`,
        borderRadius: '6px',
        color: conf.color,
        fontSize: '13px',
        ...style,
      }}
    >
      {showIcon && <div style={{ marginTop: '1px' }}>{conf.icon}</div>}
      <div style={{ flex: 1 }}>
        {message && <div style={{ fontWeight: 600 }}>{message}</div>}
        {description && <div style={{ marginTop: '4px', opacity: 0.9 }}>{description}</div>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   Tooltip
------------------------------------------------------------- */
export function Tooltip({ title, children }) {
  return <span title={title}>{children}</span>;
}

/* -------------------------------------------------------------
   Descriptions
------------------------------------------------------------- */
export function Descriptions({ items = [], bordered = true, column = 1, style = {} }) {
  return (
    <div
      style={{
        border: bordered ? '1px solid #e5e7eb' : 'none',
        borderRadius: '6px',
        overflow: 'hidden',
        fontSize: '13px',
        ...style,
      }}
    >
      {items.map((item, idx) => (
        <div
          key={item.key || idx}
          style={{
            display: 'flex',
            borderBottom: idx < items.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}
        >
          <div
            style={{
              width: '180px',
              padding: '8px 12px',
              backgroundColor: '#f9fafb',
              fontWeight: 500,
              color: '#4b5563',
            }}
          >
            {item.label}
          </div>
          <div style={{ flex: 1, padding: '8px 12px', color: '#111827' }}>
            {item.children}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------
   Timeline
------------------------------------------------------------- */
export function Timeline({ items = [], style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px', ...style }}>
      {items.map((item, idx) => (
        <div key={item.key || idx} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: 'var(--ld-primary, #2563eb)',
              marginTop: '4px',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>{item.children}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------
   Collapse
------------------------------------------------------------- */
export function Collapse({ items = [], style = {} }) {
  const [openKeys, setOpenKeys] = useState(() => items.map((_, i) => String(i)));

  const toggle = (key) => {
    setOpenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', ...style }}>
      {items.map((it, idx) => {
        const isOpen = openKeys.includes(it.key || String(idx));
        return (
          <div key={it.key || idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
            <div
              onClick={() => toggle(it.key || String(idx))}
              style={{
                padding: '10px 14px',
                backgroundColor: '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div>{it.label}</div>
              <ChevronDown
                size={16}
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  color: '#6b7280',
                }}
              />
            </div>
            {isOpen && <div style={{ padding: '12px 14px', backgroundColor: '#ffffff' }}>{it.children}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------
   Toast Message helper
------------------------------------------------------------- */
export const message = {
  success: (msg) => {
    console.log('[SUCCESS]', msg);
    alert(msg);
  },
  error: (msg) => {
    console.error('[ERROR]', msg);
    alert(`Lỗi: ${msg}`);
  },
  info: (msg) => {
    console.log('[INFO]', msg);
  },
  warning: (msg) => {
    console.warn('[WARNING]', msg);
  },
};

export default {
  Typography,
  Button,
  Tag,
  Card,
  Space,
  Tabs,
  Table,
  Modal,
  Drawer,
  Input,
  Radio,
  Select,
  Segmented,
  Progress,
  Skeleton,
  Empty,
  Result,
  Alert,
  Tooltip,
  Descriptions,
  Timeline,
  Collapse,
  message,
};
