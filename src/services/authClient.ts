import { TenantContext } from '../types';
import { getStoredActiveInstitutionId } from './tenantService';

export interface AuthUser {
  id: string;
  email: string;
  namaLengkap: string;
  gelarDepan: string | null;
  gelarBelakang: string | null;
  nip: string | null;
  nuptk: string | null;
  nomorTelepon?: string | null;
  fotoProfilUrl?: string | null;
  preferensiMataPelajaran?: string | null;
  isActive: boolean;
}

export interface SessionResponse {
  success: boolean;
  user?: AuthUser;
  tenantContext?: TenantContext;
  error?: string;
  code?: string;
}

let cachedCsrfToken: string | null = null;

/**
 * Fetch or retrieve cached CSRF token
 */
export async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    cachedCsrfToken = null;
  }

  if (cachedCsrfToken) return cachedCsrfToken;

  try {
    const res = await fetch('/api/auth/csrf', { credentials: 'include' });
    const data = await res.json();

    if (res.ok && data.success && data.csrfToken) {
      cachedCsrfToken = data.csrfToken;
      return cachedCsrfToken as string;
    }
  } catch (e) {
    console.warn('Failed fetching CSRF token:', e);
  }

  return '';
}

/**
 * Common fetch helper that automatically includes credentials and CSRF header
 */
export async function secureFetch(
  endpoint: string,
  options: RequestInit = {},
  activeInstitutionId?: string
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  headers.set('Accept', 'application/json');
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (activeInstitutionId) {
    headers.set('X-Institution-Id', activeInstitutionId);
  }

  const requiresCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const sendRequest = () => fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Ensures HttpOnly cookie is attached
  });

  if (!requiresCsrf) {
    return sendRequest();
  }

  const csrf = await getCsrfToken();
  if (csrf) {
    headers.set('X-CSRF-Token', csrf);
  }

  let response = await sendRequest();

  if (response.status === 403) {
    const responseData = await response.clone().json().catch(() => null);
    const recoverableCsrfErrors = [
      'CSRF_TOKEN_MISSING',
      'CSRF_SIGNATURE_INVALID',
    ];

    if (recoverableCsrfErrors.includes(responseData?.code)) {
      const refreshedCsrf = await getCsrfToken(true);

      if (refreshedCsrf) {
        headers.set('X-CSRF-Token', refreshedCsrf);
        response = await sendRequest();
      }
    }
  }

  return response;
}

/**
 * Get current verified session from backend
 */
export async function getCurrentSession(): Promise<SessionResponse> {
  try {
    const activeInstitutionId = getStoredActiveInstitutionId();
    const res = await secureFetch(
      '/api/auth/me',
      {},
      activeInstitutionId || undefined
    );
    if (res.status === 401) {
      return { success: false, code: 'UNAUTHENTICATED' };
    }
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghubungi server autentikasi' };
  }
}

/**
 * Login with email and password
 */
export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string; retryAfterSeconds?: number }> {
  try {
    const res = await secureFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (data.csrfToken) {
      cachedCsrfToken = data.csrfToken;
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal melakukan login' };
  }
}

/**
 * Register a new user
 */
export async function register(params: {
  namaLengkap: string;
  email: string;
  password: string;
  gelarDepan?: string;
  gelarBelakang?: string;
  nip?: string;
  nuptk?: string;
  nomorTelepon?: string;
  preferensiMataPelajaran?: string;
  npsn?: string;
}): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const res = await secureFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (data.csrfToken) {
      cachedCsrfToken = data.csrfToken;
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mendaftar akun baru' };
  }
}

/**
 * Logout current session
 */
export async function logout(): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await secureFetch('/api/auth/logout', { method: 'POST' });
    cachedCsrfToken = null;
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal logout' };
  }
}

/**
 * Logout all sessions
 */
export async function logoutAll(): Promise<{ success: boolean; message?: string; revokedCount?: number }> {
  try {
    const res = await secureFetch('/api/auth/logout-all', { method: 'POST' });
    cachedCsrfToken = null;
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal mencabut seluruh sesi' };
  }
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await secureFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal memproses reset password' };
  }
}


/**
 * Complete password reset using a one-time email token.
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string; retryAfterSeconds?: number }> {
  try {
    const res = await secureFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal menghubungi server autentikasi.',
    };
  }
}

/**
 * Switch active institution
 */
export async function switchInstitution(institutionId: string): Promise<any> {
  const res = await secureFetch('/api/tenant/switch-institution', {
    method: 'POST',
    body: JSON.stringify({ institutionId }),
  });
  return await res.json();
}
