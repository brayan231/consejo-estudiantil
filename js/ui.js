// ============================================================
//  ui.js — Toasts, Modals, Loaders, UI helpers
// ============================================================

/* ── Toast container ── */
function getToastContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}

/* ── Show Toast ── */
export function toast(type, title, message = '', duration = 4000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const c   = getToastContainer();
  const el  = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div>
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
  `;
  c.appendChild(el);

  // Auto remove
  const remove = () => {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  const timer = setTimeout(remove, duration);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

export const toastSuccess = (t, m) => toast('success', t, m);
export const toastError   = (t, m) => toast('error', t, m);
export const toastInfo    = (t, m) => toast('info', t, m);
export const toastWarning = (t, m) => toast('warning', t, m);

/* ── Loader ── */
let loaderEl = null;
export function showLoader(text = 'Cargando...') {
  if (loaderEl) return;
  loaderEl = document.createElement('div');
  loaderEl.className = 'loader-overlay';
  loaderEl.innerHTML = `<div class="loader-ring"></div><div class="loader-text">${text}</div>`;
  document.body.appendChild(loaderEl);
}
export function hideLoader() {
  if (loaderEl) { loaderEl.remove(); loaderEl = null; }
}

/* ── Open / Close Modal ── */
export function openModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.style.animation = 'fadeIn .2s both';
  document.body.style.overflow = 'hidden';
  // Close on backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(id);
  }, { once: true });
}
export function closeModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

/* ── Confirm dialog que retorna Promise ── */
export function confirm(message) {
  return new Promise((resolve) => {
    const id = 'confirm-modal';
    let overlay = document.getElementById(id);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = id;
      overlay.className = 'modal-overlay hidden';
      overlay.innerHTML = `
        <div class="modal" style="max-width:420px">
          <div class="modal-body" style="padding:32px 28px">
            <div style="font-size:2rem;text-align:center;margin-bottom:12px">🤔</div>
            <h3 class="modal-title" style="text-align:center;margin-bottom:10px">Confirmar acción</h3>
            <p id="confirm-msg" style="text-align:center;color:var(--gray-500);font-size:.9rem"></p>
          </div>
          <div class="modal-footer" style="justify-content:center;gap:12px;padding-bottom:28px">
            <button class="btn btn-ghost" id="confirm-no">Cancelar</button>
            <button class="btn btn-danger" id="confirm-yes">Confirmar</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }
    
    document.getElementById('confirm-msg').textContent = message;
    openModal(id);
    
    const handleYes = () => {
      closeModal(id);
      cleanup();
      resolve(true);
    };
    
    const handleNo = () => {
      closeModal(id);
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      const yesBtn = document.getElementById('confirm-yes');
      const noBtn = document.getElementById('confirm-no');
      if (yesBtn) yesBtn.removeEventListener('click', handleYes);
      if (noBtn) noBtn.removeEventListener('click', handleNo);
    };
    
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');
    
    yesBtn.removeEventListener('click', handleYes);
    noBtn.removeEventListener('click', handleNo);
    
    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
  });
}

/* ── Render skeleton cards ── */
export function renderSkeletons(container, count = 3, height = '200px') {
  container.innerHTML = Array(count).fill('').map(() =>
    `<div class="skeleton" style="height:${height}"></div>`
  ).join('');
}

/* ── Empty state ── */
export function renderEmpty(container, icon, title, desc, btnHtml = '') {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      ${btnHtml}
    </div>`;
}

/* ── Set button loading ── */
export function setBtnLoading(btn, loading, originalText) {
  if (loading) {
    btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = `<span class="spinner sm"></span> Procesando...`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.orig || originalText || btn.innerHTML;
    btn.disabled = false;
  }
}

/* ── Close modal buttons ── */
document.addEventListener('click', e => {
  const closeBtn = e.target.closest('[data-close-modal]');
  if (closeBtn) {
    const id = closeBtn.dataset.closeModal;
    closeModal(id);
  }
});

/* ── ESC closes modals ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
      m.classList.add('hidden');
      document.body.style.overflow = '';
    });
  }
});