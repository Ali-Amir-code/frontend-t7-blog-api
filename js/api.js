export const API_BASE_URL = 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('token');
}

export async function apiFetch(path, options = {}) {
  const { method = 'GET', body = null, headers = {} } = options;
  const finalHeaders = { ...headers };

  const fetchOpts = { method, headers: finalHeaders };

  if (body && !(body instanceof FormData)) {
    // JSON body
    fetchOpts.body = JSON.stringify(body);
    fetchOpts.headers['Content-Type'] = 'application/json';
  } else if (body instanceof FormData) {
    fetchOpts.body = body; // leave content-type to browser
  }

  const token = getToken();
  if (token) fetchOpts.headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE_URL + path, fetchOpts);
  let data;
  try { data = await res.json(); } catch (err) { data = null; }
  if (!res.ok) {
    const message = data?.message || res.statusText || 'API error';
    throw new Error(message);
  }
  return data;
}