import Cookies from 'js-cookie';

export const getToken = () => Cookies.get('token');

export const setToken = (token) => Cookies.set('token', token, { expires: 7 });

export const removeToken = () => Cookies.remove('token');

export const isAuthenticated = () => !!getToken();

// Mirrors backend hasFullAccess() — admins see everything; managers/TLs only their team.
export const isAdminUser = (user) =>
  Boolean(user && (user.role === 'admin' || user.isSuperAdmin || user.isServiceAccount));

// Pages that only make sense org-wide; the backend rejects managers there anyway.
export const ADMIN_ONLY_PATHS = ['/users', '/reports/users', '/activity'];
export const isAdminOnlyPath = (path) =>
  ADMIN_ONLY_PATHS.some((p) => path === p || path.startsWith(p + '/'));
