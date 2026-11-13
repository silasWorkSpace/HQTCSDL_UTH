/**
 * Định nghĩa hằng số các đường dẫn router trong LivingDocs
 */
export const ROUTES = {
  HOME: '/',
  DOCUMENTS: '/documents',
  DOCUMENT_DETAIL: (id = ':id') => `/documents/${id}`,
  DOCUMENT_EDIT: (id = ':id') => `/documents/${id}/edit`,
  DOCUMENT_DIFF: (id = ':id', v1 = ':v1', v2 = ':v2') => `/documents/${id}/diff/${v1}/${v2}`,
  TEMPLATES: '/templates',
  TEMPLATE_EDIT: (id = ':id') => `/templates/${id}/edit`,
  REVIEWS: '/reviews',
  REVIEW_DETAIL: (id = ':id') => `/reviews/${id}`,
  SUGGESTIONS: '/suggestions',
  DRIFT_HISTORY: '/drift-history',
};
