import TemplateListPage from './pages/TemplateListPage';
import TemplateEditorPage from './pages/TemplateEditorPage';

/**
 * Route configurations for the Templates feature module.
 * Permissions:
 * - Read/List: Developer, TechLead / Technical Lead
 * - Create/Edit/Clone: TechLead / Technical Lead
 */
export const templateRoutes = [
  {
    path: '/templates',
    component: TemplateListPage,
    allowedRoles: ['Developer', 'Technical Lead', 'TechLead'],
  },
  {
    path: '/templates/new',
    component: TemplateEditorPage,
    allowedRoles: ['Technical Lead', 'TechLead'],
  },
  {
    path: '/templates/:id',
    component: TemplateEditorPage,
    allowedRoles: ['Developer', 'Technical Lead', 'TechLead'],
  },
];
