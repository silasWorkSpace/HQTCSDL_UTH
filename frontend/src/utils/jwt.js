// Giai ma payload cua JWT chi de AN/HIEN giao dien. Viec cho phep hay khong do server quyet dinh (NFR-SEC-02).
export function decodeJwt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(part)
    const json = decodeURIComponent(
      Array.from(binary, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}
