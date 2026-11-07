import { InstitutionRole } from '@prisma/client';

export type PermissionAction =
  | 'institution:edit_profile'
  | 'membership:view'
  | 'membership:manage'
  | 'membership:change_role'
  | 'project:create'
  | 'project:view_own'
  | 'project:view_school'
  | 'project:edit_own'
  | 'project:edit_school'
  | 'project:delete_own'
  | 'project:delete_school'
  | 'audit:view_school'
  | 'audit:view_system';

/**
 * Explicit Centralized Role-Based Access Control (RBAC) Permission Matrix.
 * All checks are evaluated on the backend server based on verified database memberships.
 */
export const ROLE_PERMISSIONS: Record<InstitutionRole, PermissionAction[]> = {
  SUPER_ADMIN: [
    'institution:edit_profile',
    'membership:view',
    'membership:manage',
    'membership:change_role',
    'project:create',
    'project:view_own',
    'project:view_school',
    'project:edit_own',
    'project:edit_school',
    'project:delete_own',
    'project:delete_school',
    'audit:view_school',
    'audit:view_system',
  ],
  SCHOOL_ADMIN: [
    'institution:edit_profile',
    'membership:view',
    'membership:manage',
    'membership:change_role',
    'project:create',
    'project:view_own',
    'project:view_school',
    'project:edit_own',
    'project:edit_school',
    'project:delete_own',
    'project:delete_school',
    'audit:view_school',
  ],
  HEADMASTER: [
    'institution:edit_profile',
    'membership:view',
    'project:create',
    'project:view_own',
    'project:view_school',
    'project:edit_own',
    'project:delete_own',
    'audit:view_school',
  ],
  TEACHER: [
    'membership:view',
    'project:create',
    'project:view_own',
    'project:edit_own',
    'project:delete_own',
  ],
  OPERATOR: [
    'membership:view',
    'project:view_school',
  ],
};

/**
 * Check if a role has the given permission.
 */
export function hasPermission(role: InstitutionRole, action: PermissionAction): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  return Boolean(allowed && allowed.includes(action));
}

/**
 * Evaluates whether a user with a given role can view a specific project.
 * Regular teachers can only view their own projects unless they hold school-wide view permission.
 */
export function canViewProject(role: InstitutionRole, isOwner: boolean): boolean {
  if (isOwner) {
    return hasPermission(role, 'project:view_own');
  }
  return hasPermission(role, 'project:view_school');
}

/**
 * Evaluates whether a user with a given role can edit a specific project.
 * Regular teachers can only edit their own projects.
 * School Admins and Super Admins can edit school-wide projects.
 */
export function canEditProject(role: InstitutionRole, isOwner: boolean): boolean {
  if (isOwner) {
    return hasPermission(role, 'project:edit_own');
  }
  return hasPermission(role, 'project:edit_school');
}

/**
 * Evaluates whether a user with a given role can delete a specific project.
 * Teachers can delete their own projects.
 * Headmasters can only delete their own projects (NOT other teachers' projects).
 * Only School Admins and Super Admins can delete school-wide projects.
 */
export function canDeleteProject(role: InstitutionRole, isOwner: boolean): boolean {
  if (isOwner) {
    return hasPermission(role, 'project:delete_own');
  }
  return hasPermission(role, 'project:delete_school');
}
