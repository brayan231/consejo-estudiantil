// ============================================================
//  noticias.js — Leer y mostrar noticias desde Firestore
// ============================================================

import { db } from './firebase-config.js';
import {
  collection, query, orderBy, limit,
  onSnapshot, getDocs, doc, getDoc, where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { formatDate, relativeTime, truncate, sanitize } from './main.js';
import { renderSkeletons, renderEmpty } from './ui.js';

const COL = 'noticias';

/* ── Cargar noticias en listado ── */
export function loadNoticias(container, opts = {}) {
  const { limite = 12, categoria = null } = opts;

  if (!container) {
    console.error('Container no encontrado para loadNoticias');
    return null;
  }

  renderSkeletons(container, 6, '280px');

  let q = query(collection(db, COL), orderBy('fechaCreacion', 'desc'), limit(limite));
  if (categoria) q = query(collection(db, COL), where('categoria', '==', categoria), orderBy('fechaCreacion', 'desc'), limit(limite));

  return onSnapshot(q, snap => {
    if (snap.empty) {
      renderEmpty(container, '📰', 'Sin noticias aún', 'Próximamente habrá novedades del Consejo Estudiantil.');
      return;
    }
    container.innerHTML = '';
    snap.forEach(d => {
      const card = buildNewsCard(d.id, d.data());
      if (card) container.appendChild(card);
    });
  }, err => {
    console.error('Error loading noticias:', err);
    renderEmpty(container, '⚠️', 'Error al cargar', 'Intenta recargar la página.');
  });
}

/* ── Cargar noticias recientes (para index) ── */
export async function loadRecentNoticias(container, count = 3) {
  if (!container) return;
  
  renderSkeletons(container, count, '300px');
  try {
    const q    = query(collection(db, COL), orderBy('fechaCreacion', 'desc'), limit(count));
    const snap = await getDocs(q);
    if (snap.empty) { 
      renderEmpty(container, '📰', 'Sin noticias', 'Vuelve pronto.'); 
      return; 
    }
    container.innerHTML = '';
    snap.forEach(d => {
      const card = buildNewsCard(d.id, d.data());
      if (card) container.appendChild(card);
    });
  } catch (e) {
    console.error('Error loading recent noticias:', e);
    renderEmpty(container, '⚠️', 'Error', 'No se pudieron cargar las noticias');
  }
}

/* ── Construir tarjeta ── */
function buildNewsCard(id, data) {
  if (!data || !data.titulo) return null;
  
  const card = document.createElement('article');
  card.className = 'card news-card reveal';

  const catColors = {
    'Académico':    'blue',
    'Cultural':     'purple',
    'Deportivo':    'green',
    'Institucional':'gold',
    'General':      'gray'
  };
  const catColor = catColors[data.categoria] || 'gray';

  card.innerHTML = `
    <div class="news-card-img-placeholder">${getCategoryEmoji(data.categoria)}</div>
    <div class="news-card-body">
      <div class="flex gap-1 flex-wrap">
        <span class="badge badge-${catColor}">${sanitize(data.categoria || 'General')}</span>
        ${data.destacado ? '<span class="badge badge-gold">⭐ Destacado</span>' : ''}
      </div>
      <h3 class="news-card-title">${sanitize(data.titulo)}</h3>
      <p class="news-card-excerpt">${sanitize(truncate(data.contenido || '', 130))}</p>
      <div class="news-card-footer">
        <span class="text-muted" title="${formatDate(data.fechaCreacion)}">${relativeTime(data.fechaCreacion)}</span>
        <a href="noticia-detalle.html?id=${id}" class="btn btn-outline btn-sm">Leer más →</a>
      </div>
    </div>`;
  return card;
}

/* ── Emoji por categoría ── */
function getCategoryEmoji(cat) {
  const m = {
    'Académico':'📚', 
    'Cultural':'🎭', 
    'Deportivo':'⚽',
    'Institucional':'🏛️', 
    'General':'📰'
  };
  return m[cat] || '📰';
}

/* ── Cargar detalle de noticia ── */
export async function loadNoticiaDetalle(id, container) {
  if (!container || !id) return;
  
  try {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) { 
      container.innerHTML = '<div class="container"><p>Noticia no encontrada.</p></div>'; 
      return; 
    }
    const d = snap.data();
    container.innerHTML = `
      <div class="page-hero">
        <div class="container page-hero-content">
          <div class="page-hero-icon">${getCategoryEmoji(d.categoria)}</div>
          <div class="flex gap-1 mb-2">
            <span class="badge badge-blue">${sanitize(d.categoria || 'General')}</span>
            ${d.destacado ? '<span class="badge badge-gold">⭐ Destacado</span>' : ''}
          </div>
          <h1>${sanitize(d.titulo)}</h1>
          <p>${formatDate(d.fechaCreacion)} · Por ${sanitize(d.autor || 'Consejo Estudiantil')}</p>
        </div>
      </div>
      <section class="section">
        <div class="container" style="max-width:760px">
          <div style="line-height:1.9;color:var(--gray-700);font-size:1.05rem;white-space:pre-wrap">${sanitize(d.contenido)}</div>
          <div class="divider"></div>
          <a href="noticias.html" class="btn btn-outline">← Volver a Noticias</a>
        </div>
      </section>`;
  } catch (e) {
    console.error('Error loading noticia detalle:', e);
    container.innerHTML = '<div class="container"><p>Error al cargar la noticia.</p></div>';
  }
}

/* ── Filtro por categoría ── */
export function initCategoryFilter(filterContainer, listContainer) {
  if (!filterContainer || !listContainer) {
    console.error('Filter container or list container not found');
    return;
  }
  
  const categorias = ['Todas', 'Académico', 'Cultural', 'Deportivo', 'Institucional', 'General'];
  filterContainer.innerHTML = categorias.map((c, i) =>
    `<button class="tab ${i===0?'active':''}" data-cat="${c}">${c}</button>`
  ).join('');

  let unsub = null;

  filterContainer.addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    filterContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    if (unsub && typeof unsub === 'function') unsub();
    const cat = btn.dataset.cat === 'Todas' ? null : btn.dataset.cat;
    unsub = loadNoticias(listContainer, { categoria: cat });
  });

  // Initial load
  unsub = loadNoticias(listContainer);
}