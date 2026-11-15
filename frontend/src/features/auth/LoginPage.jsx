import { useState } from 'react'
import { Button, Card, Form, Input, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ErrorAlert from '../../components/ErrorAlert'
import { useAuth } from './useAuth'

const TENANT_PATTERN = /^[a-z0-9_]{2,30}$/

export default function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const initialTenant = localStorage.getItem('ld.tenant') ?? import.meta.env.VITE_DEFAULT_TENANT ?? ''

  // Dang nhap xong AuthLayout tu chuyen huong ve trang truoc do, khong can navigate o day.
  const onFinish = async (values) => {
    setSubmitting(true)
    setError(null)
    try {
      await login(values)
    } catch (e) {
      setError(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="auth-card">
      <Typography.Title level={3}>{t('auth.login.title')}</Typography.Title>
      {error ? <ErrorAlert error={error} /> : null}
      <Form layout="vertical" requiredMark={false} initialValues={{ tenant: initialTenant }} onFinish={onFinish}>
        <Form.Item
          name="tenant"
          label={t('auth.fields.tenant')}
          rules={[
            { required: true, message: t('auth.validation.tenantRequired') },
            { pattern: TENANT_PATTERN, message: t('auth.validation.tenantFormat') },
          ]}
        >
          <Input autoComplete="organization" />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('auth.fields.email')}
          rules={[{ required: true, message: t('auth.validation.emailRequired') }]}
        >
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item
          name="password"
          label={t('auth.fields.password')}
          rules={[{ required: true, message: t('auth.validation.passwordRequired') }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          {t('auth.login.submit')}
        </Button>
      </Form>
      <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
        {t('auth.login.noAccount')} <Link to="/register">{t('auth.login.register')}</Link>
      </Typography.Paragraph>
    </Card>
  )
}
