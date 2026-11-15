import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Moi file trong vi/ va en/ la mot nhom khoa; ten file la khoa cap 1 (auth.json -> t('auth.login.title')).
// Tinh nang moi chi can them vi/<ten>.json va en/<ten>.json, khong sua file nay.
function load(modules) {
  return Object.fromEntries(
    Object.entries(modules).map(([path, mod]) => [path.split('/').pop().replace('.json', ''), mod.default]),
  )
}

const vi = load(import.meta.glob('./vi/*.json', { eager: true }))
const en = load(import.meta.glob('./en/*.json', { eager: true }))

const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('ld.lang') : null
const lng = saved === 'en' ? 'en' : 'vi'

i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng,
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
})

if (typeof document !== 'undefined') document.documentElement.lang = lng

export default i18n
