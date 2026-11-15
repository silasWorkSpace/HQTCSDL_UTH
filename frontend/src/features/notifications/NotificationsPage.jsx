import { useState } from 'react'
import { App as AntApp, Badge, Button, Segmented, Table } from 'antd'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import QueryState from '../../components/QueryState'
import { notificationApi } from '../../services/notificationApi'
import { toUserError } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

export default function NotificationsPage() {
  const { t, i18n } = useTranslation()
  const { message } = AntApp.useApp()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')
  const unreadOnly = filter === 'unread'

  const query = useQuery({
    queryKey: ['notifications', { unreadOnly }],
    queryFn: () => notificationApi.list({ unread: unreadOnly }),
    placeholderData: keepPreviousData,
  })

  const markRead = useMutation({
    mutationFn: (id) => notificationApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (error) => message.error(toUserError(error).detail),
  })

  const columns = [
    {
      title: t('notifications.columns.content'),
      key: 'content',
      render: (_, n) => n.payload?.message ?? n.eventType,
    },
    {
      title: t('notifications.columns.time'),
      dataIndex: 'createdAt',
      render: (value) => formatDateTime(value, i18n.language),
    },
    {
      title: t('notifications.columns.status'),
      dataIndex: 'readAt',
      render: (readAt) =>
        readAt ? (
          <Badge status="default" text={t('notifications.read')} />
        ) : (
          <Badge status="processing" text={t('notifications.unread')} />
        ),
    },
    {
      title: t('notifications.columns.actions'),
      key: 'actions',
      render: (_, n) =>
        n.readAt ? null : (
          <Button size="small" loading={markRead.isPending && markRead.variables === n.id} onClick={() => markRead.mutate(n.id)}>
            {t('notifications.markRead')}
          </Button>
        ),
    },
  ]

  const items = query.data ?? []

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        extra={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { label: t('notifications.filter.all'), value: 'all' },
              { label: t('notifications.filter.unread'), value: 'unread' },
            ]}
          />
        }
      />
      <QueryState
        query={query}
        isEmpty={items.length === 0}
        emptyText={unreadOnly ? t('notifications.emptyUnread') : t('notifications.empty')}
      >
        <Table rowKey="id" columns={columns} dataSource={items} pagination={false} scroll={{ x: 'max-content' }} />
      </QueryState>
    </>
  )
}
