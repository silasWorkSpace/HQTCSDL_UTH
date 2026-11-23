import DocumentListPage from './pages/DocumentListPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import DraftEditorPage from './pages/DraftEditorPage';
import VersionDiffPage from './pages/VersionDiffPage';

/**
 * Route configurations for the Documents feature module.
 * Roles: Developer, Staff, Manager, TechLead / Technical Lead (Administrator is restricted).
 */
export const documentRoutes = [
  {
    path: '/documents',
    component: DocumentListPage,
    allowedRoles: ['Developer', 'Staff', 'Manager', 'Technical Lead', 'TechLead'],
  },
  {
    path: '/documents/:id',
    component: DocumentDetailPage,
    allowedRoles: ['Developer', 'Staff', 'Manager', 'Technical Lead', 'TechLead'],
  },
  {
    path: '/documents/:id/edit',
    component: DraftEditorPage,
    allowedRoles: ['Developer'],
  },
  {
    path: '/documents/:id/diff',
    component: VersionDiffPage,
    allowedRoles: ['Developer', 'Staff', 'Manager', 'Technical Lead', 'TechLead'],
  },
];
