/**
 * Các vai trò chuẩn trong hệ thống LivingDocs theo đặc tả SRS
 */
export const ROLES = {
  DEVELOPER: 'Developer',
  TECH_LEAD: 'Technical Lead',
  STAFF: 'Staff',
  MANAGER: 'Manager',
  ADMINISTRATOR: 'Administrator',
};

export const SYSTEM_ROLES = [
  ROLES.DEVELOPER,
  ROLES.TECH_LEAD,
  ROLES.STAFF,
  ROLES.MANAGER,
  ROLES.ADMINISTRATOR,
];

export const ROLE_LABELS = {
  [ROLES.DEVELOPER]: { vi: 'Lập trình viên (Developer)', en: 'Developer' },
  [ROLES.TECH_LEAD]: { vi: 'Trưởng nhóm kỹ thuật (Tech Lead)', en: 'Technical Lead' },
  [ROLES.STAFF]: { vi: 'Người rà soát cấp 1 (Staff)', en: 'Staff Reviewer' },
  [ROLES.MANAGER]: { vi: 'Người phê duyệt cấp 2 (Manager)', en: 'Manager Approver' },
  [ROLES.ADMINISTRATOR]: { vi: 'Quản trị viên (Admin)', en: 'Administrator' },
};
