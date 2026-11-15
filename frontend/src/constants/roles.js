// 5 vai tro, khop voi backend (Roles.java) va CHECK trong bang role_assignment.
export const ROLES = Object.freeze({
  DEVELOPER: 'Developer',
  STAFF: 'Staff',
  MANAGER: 'Manager',
  TECH_LEAD: 'TechLead',
  ADMINISTRATOR: 'Administrator',
})

export const ALL_ROLES = Object.values(ROLES)
