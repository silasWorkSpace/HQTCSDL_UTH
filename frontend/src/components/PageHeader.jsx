import { Typography } from 'antd'

export default function PageHeader({ title, subtitle, extra }) {
  return (
    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
        {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
      </div>
      {extra}
    </div>
  )
}
