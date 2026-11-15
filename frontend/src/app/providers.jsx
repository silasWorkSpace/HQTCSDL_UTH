import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'
import enUS from 'antd/locale/en_US'
import viVN from 'antd/locale/vi_VN'
import { useTranslation } from 'react-i18next'
import { AuthProvider } from '../features/auth/AuthContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Loi 4xx la loi cua nguoi dung hoac quyen, thu lai khong giup ich gi.
      retry: (count, error) => {
        const status = error?.response?.status
        return count < 1 && !(status >= 400 && status < 500)
      },
    },
  },
})

export default function Providers({ children }) {
  const { i18n } = useTranslation()
  const locale = i18n.language?.startsWith('en') ? enUS : viVN
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={locale} theme={{ token: { colorPrimary: '#1f6feb' } }}>
        <AntApp>
          <AuthProvider>{children}</AuthProvider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
