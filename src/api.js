// Thin REST client for the Spring Boot backend.

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

// ws:// or wss:// URL of the STOMP endpoint, derived from the REST base URL.
export const WS_URL = BASE.replace(/^http/, 'ws') + '/ws';

const TOKEN_KEY = 'chatapp.token';

let token = null;
let unauthorizedHandler = null;

export function getToken() {
  if (token) return token;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}

export function setToken(value) {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: the session just will not survive a reload
  }
}

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const current = getToken();
  if (current) headers.Authorization = `Bearer ${current}`;

  let response;
  try {
    response = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error('Cannot reach the server. Is the backend running?'), { status: 0 });
  }

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // empty or non-JSON body
  }

  if (!response.ok) {
    if (response.status === 401 && current && unauthorizedHandler) unauthorizedHandler();
    const message = (data && data.message) || response.statusText || 'Request failed';
    throw Object.assign(new Error(message), { status: response.status });
  }
  return data;
}

export const api = {
  login: (usernameOrEmail, password) =>
    request('/api/auth/login', { method: 'POST', body: { usernameOrEmail, password } }),
  register: (username, email, password, displayName) =>
    request('/api/auth/register', {
      method: 'POST',
      body: { username, email, password, displayName: displayName || null },
    }),
  me: () => request('/api/users/me'),
  users: (q) => request(`/api/users?q=${encodeURIComponent(q || '')}`),
  presence: () => request('/api/presence'),
  rooms: () => request('/api/rooms'),
  channels: (q) => request(`/api/rooms/channels?q=${encodeURIComponent(q || '')}`),
  createChannel: (name, description) =>
    request('/api/rooms', { method: 'POST', body: { name, description: description || null } }),
  openDirect: (userId) => request(`/api/rooms/direct/${userId}`, { method: 'POST' }),
  joinChannel: (roomId) => request(`/api/rooms/${roomId}/join`, { method: 'POST' }),
  history: (roomId, before, limit = 50) =>
    request(`/api/rooms/${roomId}/messages?limit=${limit}${before ? `&before=${before}` : ''}`),
  sendMessage: (roomId, content) =>
    request(`/api/rooms/${roomId}/messages`, { method: 'POST', body: { content } }),
};
