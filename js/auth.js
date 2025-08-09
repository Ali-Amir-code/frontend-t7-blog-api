import { apiFetch } from './api.js';

export function getCurrentUser() {
  return JSON.parse(localStorage.getItem('currentUser')) || null;
}
export function getToken() {
  return localStorage.getItem('token');
}

export function setAuthData(user, token) {
  localStorage.setItem('currentUser', JSON.stringify(user));
  localStorage.setItem('token', token);
}

export function clearAuthData() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('token');
}

export async function login(email, password) {
  return apiFetch('/users/login', { method: 'POST', body: { email, password } });
}

export async function register(username, email, password) {
  return apiFetch('/users/register', { method: 'POST', body: { username, email, password } });
}