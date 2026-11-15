import { useState } from 'react'
import { App as AntApp, Button, Card, Form, Input, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ErrorAlert from '../../components/ErrorAlert'
import { useAuth } from './useAuth'

const TENANT_PATTERN = /^[a-z0-9_]{2,30}$/

export default function RegisterPage() {
  const { t } = useTranslation()
  const { register } = useAuth()
  const { message } = AntApp.useApp()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const initialTenant = localStorage.getItem('ld.tenant') ?? import.meta.env.VITE_DEFAULT_TENANT ?? ''

  const onFinish = async ({ tenant, displayName, email, password }) => {
    setSubmitting(true)
    setError(null)
    try {
      await register({ tenant, displayName, email, password })
      message.success(t('auth.register.success'))
      navigate('/login', { replace: true })
    } catch (e) {
      setError(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="auth-card">
      <Typography.Title level={3}>{t('auth.register.title')}</Typography.Title>
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
          name="displayName"
          label={t('auth.fields.displayName')}
          rules={[{ required: true, message: t('auth.validation.displayNameRequired') }]}
        >
          <Input autoComplete="name" />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('auth.fields.email')}
          rules={[
            { required: true, message: t('auth.validation.emailRequired') },
            { type: 'email', message: t('auth.validation.emailFormat') },
          ]}
        >
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item
          name="password"
          label={t('auth.fields.password')}
          rules={[
            { required: true, message: t('auth.validation.passwordRequired') },
            { min: 8, max: 72, message: t('auth.validation.passwordLength') },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label={t('auth.fields.confirmPassword')}
          dependencies={['password']}
          rules={[
            { required: true, message: t('auth.validation.passwordRequired') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve()
                return Promise.reject(new Error(t('auth.validation.confirmMismatch')))
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          {t('auth.register.submit')}
        </Button>
      </Form>
      <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
        {t('auth.register.hasAccount')} <Link to="/login">{t('auth.register.login')}</Link>
      </Typography.Paragraph>
    </Card>
  )
}
