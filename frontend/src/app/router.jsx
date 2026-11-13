import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

// Document Feature Pages
import DocumentListPage from '../features/documents/pages/DocumentListPage';
import DocumentDetailPage from '../features/documents/pages/DocumentDetailPage';
import DraftEditorPage from '../features/documents/pages/DraftEditorPage';
import VersionDiffPage from '../features/documents/pages/VersionDiffPage';

// Template Feature Pages
import TemplateListPage from '../features/templates/pages/TemplateListPage';
import TemplateEditorPage from '../features/templates/pages/TemplateEditorPage';

export function AppRoutes({ activeRole }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={ROUTES.DOCUMENTS} replace />} />

      {/* Document Routes */}
      <Route path={ROUTES.DOCUMENTS} element={<DocumentListPage activeRole={activeRole} />} />
      <Route path="/documents/:id" element={<DocumentDetailPage activeRole={activeRole} />} />
      <Route path="/documents/:id/edit" element={<DraftEditorPage activeRole={activeRole} />} />
      <Route path="/documents/:id/diff/:v1/:v2" element={<VersionDiffPage activeRole={activeRole} />} />

      {/* Template Routes */}
      <Route path={ROUTES.TEMPLATES} element={<TemplateListPage activeRole={activeRole} />} />
      <Route path="/templates/:id/edit" element={<TemplateEditorPage activeRole={activeRole} />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={ROUTES.DOCUMENTS} replace />} />
    </Routes>
  );
}

export default AppRoutes;
