// Tu dong gom moi file handlers/<ten>.js (moi file export mang `handlers`). Them tinh nang moi chi can them file.
const modules = import.meta.glob(['./*.js', '!./index.js'], { eager: true })

export const handlers = Object.values(modules).flatMap((mod) => mod.handlers ?? [])
