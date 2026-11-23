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

// Review Feature Pages (WF-01 to WF-22)
import ReviewQueuePage from '../features/reviews/ReviewQueuePage';
import ReviewPage from '../features/reviews/ReviewPage';

// Suggestion & Drift Feature Pages (DR-01 to DR-12, AUTO-01 to AUTO-09)
import SuggestionQueuePage from '../features/suggestions/SuggestionQueuePage';
import DriftHistoryPage from '../features/suggestions/DriftHistoryPage';

// Governance Pages
import GovernanceDashboardPage from '../features/governance/pages/GovernanceDashboardPage';
import PolicyManagementPage from '../features/governance/pages/PolicyManagementPage';

// Auth Pages (FR-AUTH-02)
import LoginPage from '../features/auth/pages/LoginPage';
import OAuthCallbackPage from '../features/auth/pages/OAuthCallbackPage';

export function AppRoutes({ activeRole }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={ROUTES.DOCUMENTS} replace />} />

      {/* Auth Routes */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.AUTH_CALLBACK} element={<OAuthCallbackPage />} />

      {/* Document Routes */}
      <Route path={ROUTES.DOCUMENTS} element={<DocumentListPage activeRole={activeRole} />} />
      <Route path="/documents/:id" element={<DocumentDetailPage activeRole={activeRole} />} />
      <Route path="/documents/:id/edit" element={<DraftEditorPage activeRole={activeRole} />} />
      <Route path="/documents/:id/diff/:v1/:v2" element={<VersionDiffPage activeRole={activeRole} />} />

      {/* Template Routes */}
      <Route path={ROUTES.TEMPLATES} element={<TemplateListPage activeRole={activeRole} />} />
      <Route path="/templates/:id/edit" element={<TemplateEditorPage activeRole={activeRole} />} />

      {/* Review Workflow Routes */}
      <Route path={ROUTES.REVIEWS} element={<ReviewQueuePage activeRole={activeRole} />} />
      <Route path="/reviews/:taskId" element={<ReviewPage activeRole={activeRole} />} />

      {/* Suggestion & Drift Routes */}
      <Route path={ROUTES.SUGGESTIONS} element={<SuggestionQueuePage activeRole={activeRole} />} />
      <Route path="/drift-history" element={<DriftHistoryPage activeRole={activeRole} />} />
      <Route path="/documents/:id/drift" element={<DriftHistoryPage activeRole={activeRole} />} />

      {/* Governance Routes */}
      <Route path={ROUTES.GOVERNANCE_DASHBOARD} element={<GovernanceDashboardPage activeRole={activeRole} />} />
      <Route path={ROUTES.GOVERNANCE_POLICIES} element={<PolicyManagementPage activeRole={activeRole} />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={ROUTES.DOCUMENTS} replace />} />
    </Routes>
  );
}

export default AppRoutes;
