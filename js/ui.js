export function showMessage(message, type = 'success') {
  const modal = document.getElementById('message-modal');
  modal.textContent = message;
  modal.className = `message-modal ${type}`;
  modal.style.display = 'block';
  setTimeout(() => { modal.style.display = 'none'; }, 5000);
}

export function el(sel, ctx = document) { return ctx.querySelector(sel); }
export function els(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }