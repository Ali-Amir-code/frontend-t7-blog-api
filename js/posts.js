import { apiFetch, API_BASE_URL } from './api.js';
import { getCurrentUser, clearAuthData } from './auth.js';
import { showMessage, el } from './ui.js';

const appContainer = document.getElementById('app-container');
const API_ROOT = API_BASE_URL.replace(/\/api\/?$/, ''); // base for images/files

export function updateAuthUI() {
    const currentUser = getCurrentUser();
    const userInfo = el('#user-info');
    const authBtn = el('#auth-btn');
    const createBtn = el('#create-post-btn');

    if (currentUser) {
        userInfo.textContent = `Welcome, ${currentUser.username}`;
        authBtn.textContent = 'Logout';
        createBtn.style.display = 'block';
    } else {
        userInfo.textContent = '';
        authBtn.textContent = 'Login / Register';
        createBtn.style.display = 'none';
    }
}

/** Renders posts list with simple pagination */
export async function renderPostsPage(page = 1) {
    appContainer.innerHTML = '<h2>Latest Posts</h2><div class="post-list" id="posts-container">Loading posts...</div><div id="pagination-container" class="pagination"></div>';
    const postsContainer = document.getElementById('posts-container');
    const paginationContainer = document.getElementById('pagination-container');
    const currentUser = getCurrentUser();

    try {
        const res = await apiFetch(`/posts?pageNumber=${page}`);
        // Support different response shapes
        const posts = res.posts || res.data || [];
        const pages = res.pages || res.totalPages || 1;
        const currentPage = res.page || res.pageNumber || page;

        postsContainer.innerHTML = '';
        if (!posts || posts.length === 0) {
            postsContainer.innerHTML = '<p>No posts found.</p>';
            paginationContainer.innerHTML = '';
            return;
        }

        posts.forEach(post => {
            const div = document.createElement('div');
            div.className = 'post-card';
            const liked = currentUser && Array.isArray(post.likes) && post.likes.includes(currentUser._id);
            const excerpt = (post.content || '').slice(0, 150);
            div.innerHTML = `
        <h3 data-id="${post._id}">${escapeHtml(post.title || 'Untitled')}</h3>
        <p>${escapeHtml(excerpt)}${(post.content && post.content.length > 150) ? '...' : ''}</p>
        <div class="post-meta">
          <span>by ${escapeHtml(post.author?.username || 'Unknown')} on ${formatDate(post.createdAt)}</span>
          <span><strong style="color:${liked ? '#5a67d8' : '#999'}">${post.likes?.length || 0}</strong></span>
        </div>
      `;
            div.querySelector('h3').addEventListener('click', () => { window.location.hash = `posts/${post._id}`; });
            postsContainer.appendChild(div);
        });

        // Pagination
        paginationContainer.innerHTML = '';
        for (let i = 1; i <= pages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            if (i === currentPage) btn.className = 'active';
            btn.addEventListener('click', () => renderPostsPage(i));
            paginationContainer.appendChild(btn);
        }
    } catch (err) {
        postsContainer.innerHTML = `<p style="color:red;">Error: ${escapeHtml(err.message)}</p>`;
    }
}

/** Render single post page + comments + actions */
export async function renderSinglePostPage(postId) {
    const frag = await fetch('pages/post.html').then(r => r.text());
    appContainer.innerHTML = frag;
    const container = document.getElementById('post-details-container');
    const currentUser = getCurrentUser();

    try {
        // attempt to fetch post and comments in parallel (endpoints may vary)
        const [postRes, commentsRes] = await Promise.allSettled([
            apiFetch(`/posts/${postId}`),
            apiFetch(`/comments/${postId}`)
        ]);

        if (postRes.status === 'rejected') throw postRes.reason;
        const post = postRes.value;
        const comments = (commentsRes.status === 'fulfilled' && (commentsRes.value.comments || commentsRes.value.data)) || [];

        const isAuthor = currentUser && post.author && (post.author._id === currentUser._id);
        const isLiked = currentUser && Array.isArray(post.likes) && post.likes.includes(currentUser._id);
        const imageHtml = post.image ? `<img src="${API_ROOT}/${post.image.replace(/^\/+/, '')}" alt="${escapeAttr(post.title || '')}">` : '';

        container.innerHTML = `
      <div class="post-details">
        <h1 data-id="${post._id}">${escapeHtml(post.title)}</h1>
        <div class="post-meta">by ${escapeHtml(post.author?.username || 'Unknown')} on ${formatDate(post.createdAt)}</div>
        ${imageHtml}
        <p>${escapeHtml(post.content || '')}</p>
        <div class="post-actions">
          <button id="like-btn" class="btn">${isLiked ? 'Unlike' : 'Like'} (${post.likes?.length || 0})</button>
          ${isAuthor ? '<button id="edit-post-btn" class="btn btn-secondary">Edit</button><button id="delete-post-btn" class="btn btn-danger">Delete</button>' : ''}
        </div>
      </div>
      <div class="comments-section">
        <h3>Comments</h3>
        ${currentUser ? `<form id="comment-form" class="comment-form"><textarea name="content" placeholder="Write a comment..." required></textarea><button type="submit" class="btn">Add Comment</button></form>` : '<p>You must be logged in to comment.</p>'}
        <div id="comments-container" class="comment-list"></div>
      </div>
    `;

        // Like / Unlike
        const likeBtn = document.getElementById('like-btn');
        likeBtn && likeBtn.addEventListener('click', async () => {
            if (!currentUser) { showMessage('You must log in to like', 'error'); return; }
            try {
                await apiFetch(`/posts/${postId}/like`, { method: 'PUT' });
                // re-fetch post to update counts (lightweight approach)
                renderSinglePostPage(postId);
            } catch (err) { showMessage(err.message, 'error'); }
        });

        // Edit (navigate to create page with id in hash so UI can detect edit mode) — optional
        const editBtn = document.getElementById('edit-post-btn');
        if (editBtn) editBtn.addEventListener('click', () => { window.location.hash = `create?edit=${postId}`; });

        // Delete post
        const deleteBtn = document.getElementById('delete-post-btn');
        if (deleteBtn) deleteBtn.addEventListener('click', async () => {
            if (!confirm('Delete this post?')) return;
            try {
                await apiFetch(`/posts/${postId}`, { method: 'DELETE' });
                showMessage('Post deleted');
                window.location.hash = '';
            } catch (err) { showMessage(err.message, 'error'); }
        });

        // Render comments
        const commentsContainer = document.getElementById('comments-container');
        commentsContainer.innerHTML = '';
        if (!comments || comments.length === 0) {
            commentsContainer.innerHTML = '<p>No comments yet.</p>';
        } else {
            comments.forEach(c => {
                const cc = document.createElement('div');
                cc.className = 'comment-card';
                cc.innerHTML = `<p>${escapeHtml(c.content)}</p>
          <div class="comment-meta">
            <span>by ${escapeHtml(c.author?.username || 'Anonymous')} on ${formatDate(c.createdAt)}</span>
            ${currentUser && c.author && c.author._id === currentUser._id ? `<button class="btn btn-danger" data-id="${c._id}">Delete</button>` : ''}
          </div>`;
                commentsContainer.appendChild(cc);

                const delBtn = cc.querySelector('button');
                if (delBtn) {
                    delBtn.addEventListener('click', async () => {
                        if (!confirm('Delete comment?')) return;
                        try {
                            await apiFetch(`/comments/${c._id}`, { method: 'DELETE' });
                            showMessage('Comment deleted');
                            renderSinglePostPage(postId);
                        } catch (err) { showMessage(err.message, 'error'); }
                    });
                }
            });
        }

        // Submit comment
        const commentForm = document.getElementById('comment-form');
        if (commentForm) {
            commentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const content = e.target.content.value.trim();
                if (!content) return showMessage('Comment cannot be empty', 'error');
                try {
                    await apiFetch(`/comments/${postId}`, { method: 'POST', body: { content } });
                    showMessage('Comment added');
                    renderSinglePostPage(postId);
                } catch (err) { showMessage(err.message, 'error'); }
            });
        }
    } catch (err) {
        container.innerHTML = `<p style="color:red;">Error: ${escapeHtml(err.message)}</p>`;
    }
}

/** Render create post page and handle create (and optional edit flow) */
export async function renderCreatePostPage() {
    const current = getCurrentUser();
    if (!current) {
        window.location.hash = 'login';
        showMessage('You must be logged in to create a post', 'error');
        return;
    }

    const frag = await fetch('pages/create.html').then(r => r.text());
    appContainer.innerHTML = frag;

    const form = document.getElementById('create-post-form');
    if (!form) return;

    // If hash contains edit param, optionally load post data to prefill (light support)
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const editId = params.get('edit');
    if (editId) {
        try {
            const post = await apiFetch(`/posts/${editId}`);
            form.title.value = post.title || '';
            form.content.value = post.content || '';
            // image input left for user to re-upload if desired
        } catch (err) {
            showMessage('Could not load post for editing', 'error');
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);

        try {
            if (editId) {
                // If editing, use PUT (API-dependent)
                const res = await fetch(API_BASE_URL + `/posts/${editId}`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    body: fd
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to update post');
                showMessage('Post updated');
                window.location.hash = `posts/${editId}`;
            } else {
                const res = await fetch(API_BASE_URL + '/posts', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    body: fd
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to create post');
                showMessage('Post created');
                window.location.hash = '';
            }
        } catch (err) {
            // handle token expiry-ish errors by logging out
            if (err.message && /token|auth|unauth/i.test(err.message)) {
                clearAuthData();
                showMessage('Authentication error, please login again', 'error');
                window.location.hash = 'login';
            } else {
                showMessage(err.message || 'Unexpected error', 'error');
            }
        }
    });
}

function formatDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString(); } catch (e) { return d; }
}
function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function escapeAttr(s = '') { return escapeHtml(s).replace(/"/g, '&quot;'); }
