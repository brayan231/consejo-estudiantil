// ============================================================
//  eventos.js — Cargar y mostrar eventos desde Firestore
// ============================================================

import { db } from './firebase-config.js';
import {
  collection, query, orderBy, onSnapshot,
  getDocs, limit, where, Timestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { formatDate, monthName, daysLeft, sanitize, truncate } from './main.js';
import { renderSkeletons, renderEmpty } from './ui.js';

const COL = 'eventos';

/* ── Cargar todos los eventos ── */
export function loadEventos(container, filter = 'proximos') {
  renderSkeletons(container, 4, '100px');

  const now = Timestamp.now();
  let q;

  if (filter === 'proximos') {
    q = query(collection(db, COL), where('fecha', '>=', now), orderBy('fecha', 'asc'), limit(20));
  } else if (filter === 'pasados') {
    q = query(collection(db, COL), where('fecha', '<', now), orderBy('fecha', 'desc'), limit(20));
  } else {
    q = query(collection(db, COL), orderBy('fecha', 'asc'), limit(40));
  }

  return onSnapshot(q, snap => {
    if (snap.empty) {
      renderEmpty(container, '📅', 'No hay eventos', 'Próximamente se publicarán nuevos eventos.');
      return;
    }
    container.innerHTML = '';
    snap.forEach(d => container.appendChild(buildEventCard(d.id, d.data())));
  });
}

/* ── Cargar eventos próximos (para index) ── */
export async function loadRecentEventos(container, count = 4) {
  renderSkeletons(container, count, '100px');
  try {
    const now  = Timestamp.now();
    const q    = query(collection(db, COL), where('fecha', '>=', now), orderBy('fecha', 'asc'), limit(count));
    const snap = await getDocs(q);
    if (snap.empty) { renderEmpty(container, '📅', 'Sin eventos próximos', ''); return; }
    container.innerHTML = '';
    snap.forEach(d => container.appendChild(buildEventCard(d.id, d.data())));
  } catch (e) {
    console.error(e);
  }
}

/* ── Construir tarjeta de evento ── */
function buildEventCard(id, data) {
  const date  = data.fecha ? (data.fecha.toDate ? data.fecha.toDate() : new Date(data.fecha)) : new Date();
  const day   = date.getDate().toString().padStart(2, '0');
  const month = monthName(date);
  const left  = daysLeft(data.fecha);

  const typeColors = {
    'Académico': 'blue', 'Cultural': 'purple', 'Deportivo': 'green',
    'Institucional': 'gold', 'Social': 'orange', 'General': 'gray'
  };
  const color = typeColors[data.tipo] || 'gray';

  const card = document.createElement('div');
  card.className = 'card event-card reveal';
  card.innerHTML = `
    <div class="event-card-date">
      <span class="event-card-day">${day}</span>
      <span class="event-card-month">${month}</span>
    </div>
    <div class="event-card-body">
      <div class="flex gap-1 mb-2" style="flex-wrap:wrap">
        <span class="badge badge-${color}">${sanitize(data.tipo || 'General')}</span>
        ${left !== null && left >= 0 && left <= 7
          ? `<span class="badge badge-red">⏳ ${left === 0 ? 'Hoy' : `En ${left} día${left!==1?'s':''}`}</span>`
          : ''}
        ${left !== null && left < 0 ? '<span class="badge badge-gray">Finalizado</span>' : ''}
      </div>
      <div class="event-card-title">${sanitize(data.titulo)}</div>
      <div class="event-card-meta">
        <span>🕐 ${sanitize(data.hora || '—')}</span>
        <span>📍 ${sanitize(truncate(data.lugar || '—', 40))}</span>
      </div>
      ${data.descripcion ? `<p style="font-size:.82rem;color:var(--gray-500);margin-top:8px">${sanitize(truncate(data.descripcion, 100))}</p>` : ''}
    </div>`;
  return card;
}

/* ── Filtro de eventos (tabs) ── */
export function initEventFilter(tabsEl, listEl) {
  const filters = [
    { label: 'Próximos', val: 'proximos' },
    { label: 'Pasados',  val: 'pasados'  },
    { label: 'Todos',    val: 'todos'    }
  ];
  tabsEl.innerHTML = filters.map((f, i) =>
    `<button class="tab ${i===0?'active':''}" data-filter="${f.val}">${f.label}</button>`
  ).join('');

  let unsub = loadEventos(listEl, 'proximos');

  tabsEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    tabsEl.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    if (unsub) unsub();
    unsub = loadEventos(listEl, btn.dataset.filter);
  });
}

/* ── Mini countdown ── */
export function renderCountdown(ts, el) {
  const end = ts.toDate ? ts.toDate() : new Date(ts);
  const tick = () => {
    const diff = end - Date.now();
    if (diff <= 0) { el.textContent = '¡Evento en curso!'; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    el.textContent = `${d}d ${h}h ${m}m`;
  };
  tick();
  setInterval(tick, 60000);
}