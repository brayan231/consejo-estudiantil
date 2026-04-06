// ============================================================
//  admin.js — Login, Panel de Administración, CRUD
// ============================================================

import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
  query, orderBy, onSnapshot, serverTimestamp,
  getDocs, getDoc, where, Timestamp, limit
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { formatDate, relativeTime, sanitize } from './main.js';
import { toastSuccess, toastError, toastInfo, setBtnLoading, confirm, openModal, closeModal, renderSkeletons, renderEmpty } from './ui.js';

/* ══════════════════════════════════
   AUTH
══════════════════════════════════ */
export function initLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn   = form.querySelector('[type="submit"]');
    const email = form.querySelector('[name="email"]').value.trim();
    const pass  = form.querySelector('[name="password"]').value;

    if (!email || !pass) { toastError('Campos requeridos', 'Ingresa email y contraseña.'); return; }

    setBtnLoading(btn, true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toastSuccess('Bienvenido', 'Accediendo al panel...');
      setTimeout(() => showPanel(), 800);
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential'
        ? 'Correo o contraseña incorrectos.'
        : 'Error de autenticación. Intenta nuevamente.';
      toastError('Acceso denegado', msg);
    } finally {
      setBtnLoading(btn, false);
    }
  });
}

export function initAuthGuard() {
  onAuthStateChanged(auth, user => {
    if (user) { showPanel(); loadDashboard(); }
    else       { showLogin(); }
  });
}

function showLogin() {
  document.getElementById('login-section')?.classList.remove('hidden');
  document.getElementById('panel-section')?.classList.add('hidden');
}
function showPanel() {
  document.getElementById('login-section')?.classList.add('hidden');
  document.getElementById('panel-section')?.classList.remove('hidden');
}

export function initLogout() {
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut(auth);
    toastInfo('Sesión cerrada', 'Has salido del panel de administración.');
    showLogin();
  });
}

/* ══════════════════════════════════
   SIDEBAR / TABS
══════════════════════════════════ */
export function initSidebarNav() {
  const links  = document.querySelectorAll('.sidebar-link');
  const panels = document.querySelectorAll('.panel');

  links.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.dataset.panel;
      links.forEach(l => l.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      link.classList.add('active');
      document.getElementById('panel-' + target)?.classList.add('active');
      updateTopbarTitle(link.textContent.trim());
    });
  });
}

function updateTopbarTitle(title) {
  const el = document.getElementById('topbar-title');
  if (el) el.textContent = title;
}

/* ══════════════════════════════════
   DASHBOARD STATS
══════════════════════════════════ */
export async function loadDashboard() {
  const cols = ['noticias', 'eventos', 'propuestas', 'votaciones', 'contacto'];
  const ids  = ['stat-noticias', 'stat-eventos', 'stat-propuestas', 'stat-votaciones', 'stat-opiniones'];

  for (let i = 0; i < cols.length; i++) {
    try {
      const snap = await getDocs(collection(db, cols[i]));
      const el   = document.getElementById(ids[i]);
      if (el) {
        let n = 0;
        const target = snap.size;
        const step   = () => {
          n = Math.min(n + Math.ceil(target / 20), target);
          el.textContent = n.toLocaleString('es-PE');
          if (n < target) setTimeout(step, 40);
        };
        step();
      }
    } catch(_) {}
  }

  // Recent proposals
  loadRecentItems('recent-proposals-list', 'propuestas', 5);
  loadRecentItems('recent-opinions-list', 'contacto', 5);
}

async function loadRecentItems(containerId, colName, count) {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    const q    = query(collection(db, colName), orderBy('fechaCreacion', 'desc'), limit(count));
    const snap = await getDocs(q);
    if (snap.empty) { el.innerHTML = '<p class="text-muted text-sm">Sin registros.</p>'; return; }
    el.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `
        <div style="padding:10px 0;border-bottom:1px solid var(--gray-100);display:flex;gap:12px;align-items:flex-start">
          <div style="flex:1">
            <div style="font-size:.88rem;font-weight:600;color:var(--gray-800)">${sanitize(data.titulo || data.asunto || 'Sin título')}</div>
            <div class="text-muted">${sanitize(data.autor || data.nombre || 'Anónimo')} · ${relativeTime(data.fechaCreacion)}</div>
          </div>
          ${data.estado ? `<span class="badge badge-${data.estado==='Pendiente'?'gold':data.estado==='Aprobada'?'green':'gray'}">${sanitize(data.estado)}</span>` : ''}
        </div>`;
    }).join('');
  } catch(e) { console.error(e); }
}

/* ══════════════════════════════════
   NOTICIAS ADMIN
══════════════════════════════════ */
export function initNoticiasAdmin() {
  // Form
  const form = document.getElementById('form-noticia');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const data = {
        titulo:       form.querySelector('[name="titulo"]').value.trim(),
        categoria:    form.querySelector('[name="categoria"]').value,
        contenido:    form.querySelector('[name="contenido"]').value.trim(),
        autor:        form.querySelector('[name="autor"]').value.trim() || 'Consejo Estudiantil',
        destacado:    form.querySelector('[name="destacado"]')?.checked || false,
        fechaCreacion: serverTimestamp()
      };
      if (!data.titulo || !data.contenido) { toastError('Campos requeridos'); return; }
      setBtnLoading(btn, true);
      try {
        await addDoc(collection(db, 'noticias'), data);
        toastSuccess('Noticia publicada', 'Ya visible para los estudiantes.');
        form.reset();
      } catch(e) { toastError('Error', e.message); }
      finally { setBtnLoading(btn, false); }
    });
  }

  // List
  const list = document.getElementById('admin-noticias-list');
  if (list) {
    const q = query(collection(db, 'noticias'), orderBy('fechaCreacion', 'desc'), limit(20));
    onSnapshot(q, snap => {
      if (snap.empty) { renderEmpty(list, '📰', 'Sin noticias', ''); return; }
      list.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Título</th><th>Categoría</th><th>Fecha</th><th>Acciones</th></tr></thead>
            <tbody>
              ${snap.docs.map(d => {
                const dd = d.data();
                return `<tr>
                  <td style="font-weight:600">${sanitize(dd.titulo)}</td>
                  <td><span class="badge badge-blue">${sanitize(dd.categoria)}</span></td>
                  <td class="text-muted">${formatDate(dd.fechaCreacion)}</td>
                  <td class="td-actions">
                    <button class="btn btn-danger btn-sm" onclick="adminDeleteDoc('noticias','${d.id}')">🗑 Eliminar</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    });
  }
}

/* ══════════════════════════════════
   EVENTOS ADMIN
══════════════════════════════════ */
export function initEventosAdmin() {
  const form = document.getElementById('form-evento');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn  = form.querySelector('[type="submit"]');
      const fStr = form.querySelector('[name="fecha"]').value;
      if (!fStr) { toastError('Fecha requerida'); return; }
      const data = {
        titulo:        form.querySelector('[name="titulo"]').value.trim(),
        tipo:          form.querySelector('[name="tipo"]').value,
        descripcion:   form.querySelector('[name="descripcion"]').value.trim(),
        lugar:         form.querySelector('[name="lugar"]').value.trim(),
        hora:          form.querySelector('[name="hora"]').value,
        fecha:         Timestamp.fromDate(new Date(fStr + 'T00:00:00')),
        fechaCreacion: serverTimestamp()
      };
      if (!data.titulo) { toastError('Título requerido'); return; }
      setBtnLoading(btn, true);
      try {
        await addDoc(collection(db, 'eventos'), data);
        toastSuccess('Evento creado', 'Los estudiantes ya pueden verlo.');
        form.reset();
      } catch(e) { toastError('Error', e.message); }
      finally { setBtnLoading(btn, false); }
    });
  }

  const list = document.getElementById('admin-eventos-list');
  if (list) {
    const q = query(collection(db, 'eventos'), orderBy('fecha', 'desc'), limit(20));
    onSnapshot(q, snap => {
      if (snap.empty) { renderEmpty(list, '📅', 'Sin eventos', ''); return; }
      list.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Evento</th><th>Tipo</th><th>Fecha</th><th>Lugar</th><th>Acciones</th></tr></thead>
            <tbody>
              ${snap.docs.map(d => {
                const dd = d.data();
                return `<tr>
                  <td style="font-weight:600">${sanitize(dd.titulo)}</td>
                  <td><span class="badge badge-purple">${sanitize(dd.tipo)}</span></td>
                  <td>${formatDate(dd.fecha)}</td>
                  <td class="text-muted">${sanitize(dd.lugar||'—')}</td>
                  <td class="td-actions">
                    <button class="btn btn-danger btn-sm" onclick="adminDeleteDoc('eventos','${d.id}')">🗑 Eliminar</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    });
  }
}

/* ══════════════════════════════════
   VOTACIONES ADMIN
══════════════════════════════════ */
export function initVotacionesAdmin() {
  let opciones = ['', ''];

  const renderOpciones = () => {
    const c = document.getElementById('opciones-container');
    if (!c) return;
    c.innerHTML = opciones.map((o, i) => `
      <div class="flex gap-1 items-center mt-1">
        <input class="form-control opcion-input" type="text" placeholder="Opción ${i+1}" value="${sanitize(o)}" data-idx="${i}">
        ${opciones.length > 2 ? `<button class="btn btn-ghost btn-icon btn-sm" data-remove="${i}">✕</button>` : ''}
      </div>`).join('');

    c.querySelectorAll('.opcion-input').forEach(inp => {
      inp.addEventListener('input', () => { opciones[parseInt(inp.dataset.idx)] = inp.value; });
    });
    c.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => { opciones.splice(parseInt(btn.dataset.remove), 1); renderOpciones(); });
    });
  };

  document.getElementById('btn-add-opcion')?.addEventListener('click', () => {
    opciones.push(''); renderOpciones();
  });

  renderOpciones();

  const form = document.getElementById('form-votacion');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const validas = opciones.filter(o => o.trim());
      if (validas.length < 2) { toastError('Mínimo 2 opciones', 'Agrega al menos 2 opciones.'); return; }

      const fStr = form.querySelector('[name="fechaFin"]').value;
      // Guardar opciones como OBJETO {0:{...}, 1:{...}} en lugar de array.
      // Firestore no permite actualizar índices de array con notación de punto
      // (opciones.0.votos), pero sí campos de objeto. Esto hace que los votos
      // desde votaciones.html se registren correctamente.
      const opcionesObj = {};
      validas.forEach((t, i) => { opcionesObj[i] = { texto: t, votos: 0 }; });

      const data = {
        pregunta:      form.querySelector('[name="pregunta"]').value.trim(),
        descripcion:   form.querySelector('[name="descripcion"]').value.trim(),
        opciones:      opcionesObj,
        fechaFin:      fStr ? Timestamp.fromDate(new Date(fStr + 'T23:59:59')) : null,
        activa:        true,
        fechaCreacion: serverTimestamp()
      };
      if (!data.pregunta) { toastError('Pregunta requerida'); return; }
      setBtnLoading(btn, true);
      try {
        await addDoc(collection(db, 'votaciones'), data);
        toastSuccess('Votación creada', 'Los estudiantes ya pueden participar.');
        form.reset(); opciones = ['','']; renderOpciones();
      } catch(e) { toastError('Error', e.message); }
      finally { setBtnLoading(btn, false); }
    });
  }

  // List
  const list = document.getElementById('admin-votaciones-list');
  if (list) {
    const q = query(collection(db, 'votaciones'), orderBy('fechaCreacion', 'desc'), limit(10));
    onSnapshot(q, snap => {
      if (snap.empty) { renderEmpty(list, '🗳️', 'Sin votaciones', ''); return; }
      list.innerHTML = '';
      snap.forEach(d => {
        const dd = d.data();
        // Normalizar opciones: objeto {0:{...},1:{...}} o array legacy
        const opcsNorm = dd.opciones
          ? (Array.isArray(dd.opciones)
              ? dd.opciones
              : Object.keys(dd.opciones).sort((a,b)=>Number(a)-Number(b)).map(k => dd.opciones[k]))
          : [];
        const total = opcsNorm.reduce((s,o)=>s+(o.votos||0),0);
        const div = document.createElement('div');
        div.className = 'admin-section';
        div.innerHTML = `
          <div class="admin-section-header">
            <div>
              <div class="admin-section-title">${sanitize(dd.pregunta)}</div>
              <div class="text-muted">${total} voto${total!==1?'s':''} · ${formatDate(dd.fechaCreacion)}</div>
            </div>
            <div class="flex gap-1">
              <span class="badge badge-${dd.activa?'green':'gray'}">${dd.activa?'Activa':'Cerrada'}</span>
              <button class="btn btn-ghost btn-sm" onclick="adminToggleVotacion('${d.id}',${dd.activa})">
                ${dd.activa?'Cerrar':'Reabrir'}
              </button>
              <button class="btn btn-danger btn-sm" onclick="adminDeleteDoc('votaciones','${d.id}')">🗑</button>
            </div>
          </div>
          <div class="admin-section-body">
            ${opcsNorm.map(o => {
              const pct = total > 0 ? Math.round((o.votos||0)/total*100) : 0;
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:5px">
                  <span style="color:rgba(255,255,255,.82)">${sanitize(o.texto)}</span>
                  <strong style="color:#00c8f0;font-family:'Fira Code',monospace">${o.votos||0} (${pct}%)</strong>
                </div>
                <div style="height:7px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#00c8f0,#8b5cf6);border-radius:99px;transition:width .8s ease"></div>
                </div>
              </div>`;
            }).join('')}
          </div>`;
        list.appendChild(div);
      });
    });
  }
}

/* ══════════════════════════════════
   PROPUESTAS / OPINIONES ADMIN
══════════════════════════════════ */
export function initPropuestasAdmin() {
  const list = document.getElementById('admin-propuestas-list');
  if (!list) return;
  const q = query(collection(db, 'propuestas'), orderBy('fechaCreacion', 'desc'), limit(30));
  onSnapshot(q, snap => {
    if (snap.empty) { renderEmpty(list, '💡', 'Sin propuestas', ''); return; }
    list.innerHTML = '';
    snap.forEach(d => {
      const dd = d.data();
      const card = document.createElement('div');
      card.className = 'card proposal-card';
      card.innerHTML = `
        <div class="proposal-card-header">
          <div>
            <div class="proposal-card-title">${sanitize(dd.titulo)}</div>
            <div class="text-muted">${sanitize(dd.carrera)} · ${sanitize(dd.autor)} · ${relativeTime(dd.fechaCreacion)}</div>
          </div>
          <div class="flex gap-1 flex-col items-center">
            <span class="badge badge-${dd.estado==='Pendiente'?'gold':dd.estado==='Aprobada'?'green':dd.estado==='Rechazada'?'red':'blue'}">${sanitize(dd.estado)}</span>
          </div>
        </div>
        <p class="proposal-card-body">${sanitize(dd.contenido)}</p>
        <div class="proposal-card-footer">
          <span class="badge badge-gray">${sanitize(dd.categoria)}</span>
          <div class="flex gap-1">
            <button class="btn btn-success btn-sm" onclick="adminUpdateEstado('propuestas','${d.id}','Aprobada')">✓ Aprobar</button>
            <button class="btn btn-danger btn-sm" onclick="adminUpdateEstado('propuestas','${d.id}','Rechazada')">✗ Rechazar</button>
            <button class="btn btn-ghost btn-sm" onclick="adminDeleteDoc('propuestas','${d.id}')">🗑</button>
          </div>
        </div>`;
      list.appendChild(card);
    });
  });
}

export function initOpinionesAdmin() {
  const list = document.getElementById('admin-opiniones-list');
  if (!list) return;
  const q = query(collection(db, 'contacto'), orderBy('fechaCreacion', 'desc'), limit(30));
  onSnapshot(q, snap => {
    if (snap.empty) { renderEmpty(list, '💬', 'Sin opiniones', ''); return; }
    list.innerHTML = '';
    snap.forEach(d => {
      const dd = d.data();
      const card = document.createElement('div');
      card.className = 'card proposal-card';
      card.innerHTML = `
        <div class="proposal-card-header">
          <div>
            <div class="proposal-card-title">${sanitize(dd.asunto || 'Sin asunto')}</div>
            <div class="text-muted">${sanitize(dd.nombre)} · ${sanitize(dd.email||'Sin email')} · ${relativeTime(dd.fechaCreacion)}</div>
          </div>
          <span class="badge badge-${dd.tipo==='Queja'?'red':dd.tipo==='Sugerencia'?'blue':'gold'}">${sanitize(dd.tipo||'General')}</span>
        </div>
        <p class="proposal-card-body">${sanitize(dd.mensaje)}</p>
        <div class="proposal-card-footer">
          <button class="btn btn-ghost btn-sm" onclick="adminDeleteDoc('contacto','${d.id}')">🗑 Eliminar</button>
        </div>`;
      list.appendChild(card);
    });
  });
}

/* ══════════════════════════════════
   GLOBAL HELPERS (window)
══════════════════════════════════ */
window.adminDeleteDoc = (col, id) => {
  confirm(`¿Eliminar este registro de "${col}"? Esta acción no se puede deshacer.`, async () => {
    try {
      await deleteDoc(doc(db, col, id));
      toastSuccess('Eliminado', 'El registro fue eliminado correctamente.');
    } catch(e) { toastError('Error', e.message); }
  });
};

window.adminUpdateEstado = async (col, id, estado) => {
  try {
    await updateDoc(doc(db, col, id), { estado });
    toastSuccess('Estado actualizado', `Marcado como "${estado}".`);
  } catch(e) { toastError('Error', e.message); }
};

window.adminToggleVotacion = async (id, activa) => {
  try {
    await updateDoc(doc(db, 'votaciones', id), { activa: !activa });
    toastSuccess(!activa ? 'Votación abierta' : 'Votación cerrada');
  } catch(e) { toastError('Error', e.message); }
};

// ============================================================
// CONTACTO / MENSAJES (MEJORADO)
// ============================================================
const contactoList = document.getElementById('admin-contacto-list');
let mensajeFilter = 'todos';

function loadContactMessages() {
  if (!contactoList) return;
  
  const q = query(collection(db, 'contacto'), orderBy('fechaCreacion', 'desc'));
  
  onSnapshot(q, (snap) => {
    // Contar no leídos para el badge
    const unreadDocs = snap.docs.filter(d => !d.data().leido);
    const badge = document.getElementById('badge-contacto');
    if (badge) badge.textContent = unreadDocs.length;
    
    // Aplicar filtro
    let filteredDocs = snap.docs;
    if (mensajeFilter === 'no-leidos') {
      filteredDocs = snap.docs.filter(d => !d.data().leido);
    } else if (mensajeFilter === 'anonimos') {
      filteredDocs = snap.docs.filter(d => d.data().anonimo === true);
    } else if (mensajeFilter === 'identificados') {
      filteredDocs = snap.docs.filter(d => d.data().anonimo !== true && d.data().nombre && d.data().nombre !== 'Anónimo');
    }
    
    if (filteredDocs.length === 0) {
      contactoList.innerHTML = `
        <div style="text-align:center;padding:3rem;color:#64748b">
          <div style="font-size:3rem;margin-bottom:1rem">💬</div>
          <p>No hay mensajes que coincidan con el filtro.</p>
        </div>`;
      return;
    }
    
    contactoList.innerHTML = filteredDocs.map(d => {
      const data = d.data();
      const fecha = data.fechaCreacion?.toDate() || new Date();
      const esNoLeido = !data.leido;
      const esAnonimo = data.anonimo || data.nombre === 'Anónimo';
      
      // Tipo de mensaje badge
      const tipoColors = {
        'Sugerencia': 'badge-green',
        'Queja': 'badge-red', 
        'Consulta': 'badge-blue',
        'Reconocimiento': 'badge-gold'
      };
      const tipoColor = tipoColors[data.tipo] || 'badge-gray';
      
      return `
        <div class="contacto-card" style="${esNoLeido ? 'border-left: 3px solid #00c8f0; background: rgba(0, 200, 240, 0.03);' : ''}">
          <div class="contacto-card-header">
            <div>
              <div class="contacto-card-title">📌 ${escapeHtml(data.asunto || 'Sin asunto')}</div>
              <div class="text-muted" style="font-size:0.7rem">
                📅 ${fecha.toLocaleDateString('es-PE')} - ${fecha.toLocaleTimeString()}
              </div>
            </div>
            <div class="flex gap-1">
              <span class="badge ${tipoColor}">${data.tipo || 'General'}</span>
              ${esNoLeido ? '<span class="badge badge-blue" style="background: rgba(0, 200, 240, 0.2); color: #00c8f0;">● Nuevo</span>' : ''}
            </div>
          </div>
          
          <!-- INFORMACIÓN DEL REMITENTE -->
          <div class="contacto-card-body">
            <div style="background: rgba(0, 200, 240, 0.05); border-radius: 10px; padding: 0.75rem; margin-bottom: 1rem;">
              <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">
                
                ${esAnonimo ? `
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 1.2rem;">🔒</span>
                    <div><strong style="color: #a78bfa;">Mensaje anónimo</strong><br><span style="font-size: 0.75rem; color: #64748b;">El remitente prefirió no compartir sus datos personales</span></div>
                  </div>
                ` : `
                  ${data.nombre && data.nombre !== 'Anónimo' ? `
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <span style="font-size: 1.1rem;">👤</span>
                      <div><strong style="color: #00c8f0;">Remitente:</strong> ${escapeHtml(data.nombre)}</div>
                    </div>
                  ` : ''}
                  
                  ${data.email ? `
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <span style="font-size: 1.1rem;">📧</span>
                      <div><strong style="color: #00c8f0;">Correo:</strong> <a href="mailto:${escapeHtml(data.email)}" style="color: #00c8f0; text-decoration: none;">${escapeHtml(data.email)}</a></div>
                    </div>
                  ` : ''}
                  
                  ${data.carrera ? `
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <span style="font-size: 1.1rem;">📚</span>
                      <div><strong style="color: #00c8f0;">Carrera:</strong> ${escapeHtml(data.carrera)}</div>
                    </div>
                  ` : ''}
                `}
                
              </div>
            </div>
            
            <!-- Mensaje -->
            <div style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(0, 0, 0, 0.3); border-radius: 8px; border-left: 2px solid #00c8f0;">
              <div style="color: #cbd5e1; white-space: pre-wrap; line-height: 1.5; font-size: 0.85rem;">
                ${escapeHtml(data.mensaje)}
              </div>
            </div>
          </div>
          
          <div class="contacto-card-footer">
            ${esNoLeido ? `
              <button class="btn btn-primary btn-sm" onclick="window.marcarLeido('${d.id}')">
                ✓ Marcar como leído
              </button>
            ` : `
              <span class="text-muted" style="font-size:0.7rem; display: flex; align-items: center; gap: 0.25rem;">
                <span>✓</span> Leído
              </span>
            `}
            <button class="btn btn-danger btn-sm" onclick="window.eliminarMensaje('${d.id}')">
              🗑 Eliminar
            </button>
          </div>
        </div>
      `;
    }).join('');
  });
}

// Funciones globales para mensajes
window.eliminarMensaje = async (id) => {
  if (confirm('¿Eliminar este mensaje? Esta acción no se puede deshacer.')) {
    try {
      await deleteDoc(doc(db, 'contacto', id));
      toastSuccess('Mensaje eliminado', 'El mensaje fue eliminado correctamente.');
    } catch(e) {
      toastError('Error', e.message);
    }
  }
};

window.marcarLeido = async (id) => {
  try {
    await updateDoc(doc(db, 'contacto', id), { leido: true });
    toastSuccess('Marcado como leído', 'El mensaje ha sido marcado.');
  } catch(e) {
    toastError('Error', e.message);
  }
};

// Inicializar
loadContactMessages();

// Filtros
document.querySelectorAll('.filter-mensaje').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-mensaje').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mensajeFilter = btn.dataset.tipo;
    loadContactMessages();
  });
});

// Función para eliminar mensaje con confirmación
window.eliminarMensaje = async (id) => {
  confirm('¿Eliminar este mensaje? Esta acción no se puede deshacer.', async () => {
    await deleteDoc(doc(db, 'contacto', id));
    toastSuccess('Mensaje eliminado', 'El mensaje fue eliminado correctamente.');
  });
};

// Función para marcar como leído
window.marcarLeido = async (id) => {
  await updateDoc(doc(db, 'contacto', id), { leido: true });
  toastSuccess('Marcado como leído', 'El mensaje ha sido marcado.');
};

// Inicializar contacto con filtros
loadContactMessages();

// Filtros de mensajes
document.querySelectorAll('.filter-mensaje').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-mensaje').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mensajeFilter = btn.dataset.tipo;
    loadContactMessages();
  });
});

// Función auxiliar para formatear fecha local
function formatDateLocal(date) {
  return date.toLocaleDateString('es-PE', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Función auxiliar para escapar HTML
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Al final de tu archivo admin.js, después de las otras inicializaciones
document.addEventListener('DOMContentLoaded', () => {
  // ... tus otras inicializaciones
  initContactoAdmin(); // Agrega esta línea
});

// Función para contar mensajes no leídos
export function initMensajesNoLeidosCounter() {
  const q = query(collection(db, 'contacto'), where('leido', '==', false));
  onSnapshot(q, (snap) => {
    const counter = document.getElementById('mensajes-nuevos-count');
    if (counter) {
      const count = snap.size;
      counter.textContent = count;
      counter.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  });
}

// Llámala también en el DOMContentLoaded
initMensajesNoLeidosCounter();