import { useState } from 'react'
import { App as AntApp, Button, Checkbox, Modal, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import QueryState from '../../components/QueryState'
import { ALL_ROLES } from '../../constants/roles'
import { adminApi } from '../../services/adminApi'
import { toUserError } from '../../utils/errors'
import { useAuth } from '../auth/useAuth'

const PAGE_SIZE = 20
const STATUS_COLOR = { active: 'green', locked: 'orange', disabled: 'red' }

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const { message } = AntApp.useApp()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(null)
  const [selectedRoles, setSelectedRoles] = useState([])

  const query = useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: () => adminApi.listUsers(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  const onError = (error) => message.error(toUserError(error).detail)

  const rolesMutation = useMutation({
    mutationFn: ({ id, roles }) => adminApi.updateRoles(id, roles),
    onSuccess: () => {
      message.success(t('admin.users.rolesUpdated'))
      setEditing(null)
      refresh()
    },
    onError,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => adminApi.updateStatus(id, status),
    onSuccess: () => {
      message.success(t('admin.users.statusUpdated'))
      refresh()
    },
    onError,
  })

  const openRoles = (record) => {
    setEditing(record)
    setSelectedRoles(record.roles)
  }

  const columns = [
    { title: t('admin.users.columns.email'), dataIndex: 'email' },
    { title: t('admin.users.columns.displayName'), dataIndex: 'displayName' },
    {
      title: t('admin.users.columns.status'),
      dataIndex: 'status',
      render: (status) => <Tag color={STATUS_COLOR[status]}>{t(`admin.users.status.${status}`)}</Tag>,
    },
    {
      title: t('admin.users.columns.roles'),
      dataIndex: 'roles',
      render: (roles) => roles.map((role) => <Tag key={role} color="blue">{t(`common.role.${role}`)}</Tag>),
    },
    {
      title: t('admin.users.columns.actions'),
      key: 'actions',
      render: (_, record) => {
        const isSelf = record.id === currentUser?.id
        const lock = record.status === 'active'
        return (
          <Space>
            <Button size="small" onClick={() => openRoles(record)}>{t('admin.users.editRoles')}</Button>
            <Popconfirm
              title={lock ? t('admin.users.lockConfirm') : t('admin.users.unlockConfirm')}
              okText={t('common.actions.confirm')}
              cancelText={t('common.actions.cancel')}
              disabled={isSelf}
              onConfirm={() => statusMutation.mutate({ id: record.id, status: lock ? 'locked' : 'active' })}
            >
              <Button size="small" danger={lock} disabled={isSelf} title={isSelf ? t('admin.users.cannotSelf') : undefined}>
                {lock ? t('admin.users.lock') : t('admin.users.unlock')}
              </Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  const users = query.data ?? []

  return (
    <>
      <PageHeader title={t('admin.users.title')} subtitle={t('admin.users.subtitle')} />
      <QueryState query={query} isEmpty={users.length === 0 && page === 0} emptyText={t('admin.users.empty')}>
        <Table rowKey="id" columns={columns} dataSource={users} pagination={false} scroll={{ x: 'max-content' }} />
        <Space style={{ marginTop: 16 }}>
          <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t('common.actions.previous')}</Button>
          <Button disabled={users.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>{t('common.actions.next')}</Button>
        </Space>
      </QueryState>

      <Modal
        open={Boolean(editing)}
        title={t('admin.users.rolesDialogTitle', { email: editing?.email })}
        okText={t('common.actions.save')}
        cancelText={t('common.actions.cancel')}
        confirmLoading={rolesMutation.isPending}
        onOk={() => rolesMutation.mutate({ id: editing.id, roles: selectedRoles })}
        onCancel={() => setEditing(null)}
      >
        <Typography.Paragraph type="secondary">{t('admin.users.rolesHint')}</Typography.Paragraph>
        <Checkbox.Group
          value={selectedRoles}
          onChange={setSelectedRoles}
          options={ALL_ROLES.map((role) => ({ label: t(`common.role.${role}`), value: role }))}
        />
      </Modal>
    </>
  )
}
