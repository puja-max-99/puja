const SESSION_STORAGE_KEY = 'pj_session_token_v1';

let inMemoryBearerToken: string | null = null;
let inMemorySessionToken: string | null = null;

export function setInMemoryAuthToken(token: string | null) {
  inMemoryBearerToken = token;
}

export function getSessionToken(): string | null {
  if (inMemorySessionToken) return inMemorySessionToken;
  try {
    const stored =
      localStorage.getItem(SESSION_STORAGE_KEY) ||
      sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      inMemorySessionToken = stored;
      return stored;
    }
  } catch {
    // storage may be restricted in sandboxed iframes; in-memory token still works
  }
  return null;
}

export function setSessionToken(token: string | null, remember = true) {
  inMemorySessionToken = token;
  try {
    if (!token) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } else if (remember) {
      localStorage.setItem(SESSION_STORAGE_KEY, token);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors; in-memory token remains active
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const sessionToken = getSessionToken();
  if (sessionToken && !headers['X-Session-Token']) {
    headers['X-Session-Token'] = sessionToken;
  }

  if (inMemoryBearerToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${inMemoryBearerToken}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const json = (await res.json().catch(() => ({
    success: false,
    error: 'सर्वर से अमान्य उत्तर प्राप्त हुआ।',
  }))) as ApiResponse<T>;

  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }

  return json.data as T;
}
