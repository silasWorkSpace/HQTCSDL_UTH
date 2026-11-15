import { Segmented } from 'antd'
import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language?.startsWith('en') ? 'en' : 'vi'

  const change = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('ld.lang', lang)
    document.documentElement.lang = lang
  }

  return (
    <Segmented
      size="small"
      value={current}
      onChange={change}
      options={[
        { label: 'VI', value: 'vi' },
        { label: 'EN', value: 'en' },
      ]}
    />
  )
}
