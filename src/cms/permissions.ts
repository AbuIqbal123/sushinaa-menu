export const roles = ['admin', 'branch_staff'] as const;
export type Role = (typeof roles)[number];
export type Permission = 'orders' | 'users' | 'menu' | 'activity';

const granted: Record<Role, readonly Permission[]> = {
  admin: ['orders', 'users', 'menu', 'activity'],
  branch_staff: ['orders'],
};

export function allows(role: Role, permission: Permission) {
  return granted[role].includes(permission);
}
