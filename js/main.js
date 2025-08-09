// js/main.js
import { updateAuthUI, renderPostsPage, renderSinglePostPage, renderCreatePostPage } from './posts.js';
import { login, register, setAuthData, clearAuthData, getCurrentUser } from './auth.js';
import { showMessage } from './ui.js';

const authButton = document.getElementById('auth-btn');
const createPostButton = document.getElementById('create-post-btn');
const homeLink = document.getElementById('home-link');

/** Parse location.hash into { path, params (URLSearchParams) } */
function parseHash() {
  const raw = window.location.hash.slice(1); // remove leading '#'
  const [path = '', qs = ''] = raw.split('?');
  const params = new URLSearchParams(qs);
  return { path, params };
}

/** Render login/register fragment and wire its form */
async function renderAuthPageFragment(isLogin = true) {
  const page = isLogin ? 'pages/login.html' : 'pages/register.html';
  const html = await fetch(page).then(r => r.text());
  document.getElementById('app-container').innerHTML = html;

  // Switch link (login <-> register)
  document.querySelectorAll('.switch-form').forEach(el => {
    el.addEventListener('click', () => {
      window.location.hash = isLogin ? 'register' : 'login';
    });
  });

  const form = document.getElementById('auth-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const email = form.email.value.trim();
        const password = form.password.value.trim();
        const res = await login(email, password);

        // flexible extraction of token and user (support different API shapes)
        const token = res?.token || res?.data?.token || res?.accessToken;
        const user = res?.user || res?.data?.user || res;

        if (!token) throw new Error('No token returned from server');
        setAuthData(user, token);

        showMessage('Login successful');
        updateAuthUI();
        window.location.hash = '';
      } else {
        const username = form.username.value.trim();
        const email = form.email.value.trim();
        const password = form.password.value.trim();
        await register(username, email, password);
        showMessage('Registration successful — please login');
        window.location.hash = 'login';
      }
    } catch (err) {
      showMessage(err.message || 'Authentication failed', 'error');
    }
  });
}

/** Central router */
async function handleRouting() {
  const { path, params } = parseHash();

  if (!path) {
    await renderPostsPage();
    return;
  }

  if (path === 'login') return renderAuthPageFragment(true);
  if (path === 'register') return renderAuthPageFragment(false);

  if (path === 'create') {
    // renderCreatePostPage reads edit param from the URL itself; preserve query string
    return renderCreatePostPage();
  }

  if (path.startsWith('posts/')) {
    const id = path.split('/')[1];
    if (!id) return renderPostsPage();
    return renderSinglePostPage(id);
  }

  // fallback
  return renderPostsPage();
}

/** Attach stable UI listeners (header buttons) */
function initUiListeners() {
  // auth button toggles login/logout
  authButton.addEventListener('click', () => {
    if (getCurrentUser()) {
      clearAuthData();
      updateAuthUI();
      showMessage('Logged out');
      window.location.hash = '';
    } else {
      window.location.hash = 'login';
    }
  });

  // create post button
  createPostButton.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = 'create';
  });

  // logo -> home
  homeLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '';
  });
}

/** Bootstrap */
window.addEventListener('hashchange', handleRouting);
window.addEventListener('DOMContentLoaded', async () => {
  updateAuthUI();
  initUiListeners();
  await handleRouting();
});
