// ============================================================
//  main.js — Lógica compartida: navbar, scroll reveal, utils
// ============================================================

/* ── Navbar scroll effect ── */
function initNavbar() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 30);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile toggle
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
    });
    // Close on nav-link click
    links.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.classList.remove('open');
      });
    });
    // Close on outside click
    document.addEventListener('click', e => {
      if (!header.contains(e.target)) {
        links.classList.remove('open');
        toggle.classList.remove('open');
      }
    });
  }
}

/* ── Active nav link ── */
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    link.classList.toggle('active', href === page || (page === '' && href === 'index.html'));
  });
}

/* ── Scroll reveal ── */
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => io.observe(el));
}

/* ── Ripple effect on buttons ── */
function initRipple() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.cssText = `
      width:${size}px; height:${size}px;
      left:${e.clientX - rect.left - size/2}px;
      top:${e.clientY - rect.top - size/2}px;
    `;
    btn.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  });
}

/* ── Animate counters ── */
export function animateCounter(el, target, duration = 1200) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target).toLocaleString('es-PE');
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

/* ── Format date ── */
export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatDateShort(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

export function formatDateTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `Hace ${days} días`;
  return formatDateShort(ts);
}

/* ── Truncate text ── */
export function truncate(text, len = 120) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len).trimEnd() + '…' : text;
}

/* ── Sanitize HTML ── */
export function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ── Get month name (ES) ── */
export function monthName(date) {
  return date.toLocaleDateString('es-PE', { month: 'short' }).toUpperCase();
}

/* ── Days left until date ── */
export function daysLeft(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

/* ── Char counter for textarea ── */
export function initCharCounter(inputEl, counterEl, max) {
  const update = () => {
    const len = inputEl.value.length;
    counterEl.textContent = `${len} / ${max}`;
    counterEl.classList.toggle('warn',   len > max * 0.8);
    counterEl.classList.toggle('danger', len > max * 0.95);
  };
  inputEl.addEventListener('input', update);
  update();
}

/* ── Init everything ── */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  setActiveNav();
  initScrollReveal();
  initRipple();
});