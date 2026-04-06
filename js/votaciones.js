// ============================================================
//  votaciones.js — Cargar votaciones y manejar votos
//  FIXED: Firebase 10.12.2 + opciones como objeto {0:{...},1:{...}}
// ============================================================

import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, updateDoc, query, where,
  onSnapshot, increment
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { toastSuccess, toastError } from './ui.js';
import { formatDate, sanitize } from './main.js';

const COL         = 'votaciones';
const STORAGE_KEY = 'votos_realizados';

/* ─── LocalStorage helpers ─── */
function getVotosRealizados() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function guardarVoto(votacionId) {
  const votos = getVotosRealizados();
  if (!votos.includes(votacionId)) {
    votos.push(votacionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(votos));
  }
}
function yaVoto(votacionId) {
  return getVotosRealizados().includes(votacionId);
}

/* ─── Normalizar opciones ───────────────────────────────────
   Firestore guarda las opciones como OBJETO {0:{texto,votos}, 1:{texto,votos}}
   (fijado en admin.js). Esta función siempre devuelve un array,
   compatible también con documentos viejos que tengan array.
─────────────────────────────────────────────────────────── */
function normalizarOpciones(opciones) {
  if (!opciones) return [];
  if (Array.isArray(opciones)) return opciones;
  if (typeof opciones === 'object') {
    return Object.keys(opciones)
      .sort((a, b) => Number(a) - Number(b))
      .map(k => ({
        texto: opciones[k].texto || String(opciones[k]),
        votos: opciones[k].votos || 0
      }));
  }
  return [];
}

/* ─── Registrar voto (con registro de quién votó) ─── */
async function registrarVoto(votacionId, opcionIndex, opcionTexto) {
  try {
    // 1. Actualizar el contador en la votación
    await updateDoc(doc(db, COL, votacionId), {
      [`opciones.${opcionIndex}.votos`]: increment(1)
    });
    
    // 2. Guardar registro de quién votó (opcional, requiere autenticación)
    // Si tienes usuario autenticado, guarda su email
    const user = auth?.currentUser;
    const votoData = {
      opcionIndex: opcionIndex,
      opcionTexto: opcionTexto,
      fecha: serverTimestamp(),
      userAgent: navigator.userAgent,
      ip: 'client-side' // Nota: IP real requeriría backend
    };
    
    if (user) {
      votoData.email = user.email;
      votoData.userId = user.uid;
    }
    
    // Guardar en subcolección (opcional, para tener historial)
    try {
      await addDoc(collection(db, COL, votacionId, 'votos'), votoData);
    } catch (e) {
      console.warn('No se pudo guardar el voto detallado:', e);
    }
    
    guardarVoto(votacionId);
    toastSuccess('¡Voto registrado!', `Has votado por: "${opcionTexto}"`);
    return true;
  } catch (error) {
    console.error('Error al votar:', error);
    toastError('Error', 'No se pudo registrar tu voto. Intenta nuevamente.');
    return false;
  }
}

/* ─── Cargar votaciones activas (página pública) ─── */
export function loadVotaciones(container) {
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center;padding:2rem;
                color:rgba(255,255,255,.35);
                font-family:'Fira Code',monospace;font-size:.85rem">
      📡 cargando_votaciones…
    </div>`;

  const q = query(collection(db, COL), where('activa', '==', true));

  return onSnapshot(q, (snapshot) => {

    if (snapshot.empty) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem;
                    background:rgba(10,22,40,.4);
                    border:1px solid rgba(0,200,240,.1);border-radius:20px">
          <div style="font-size:3rem;opacity:.45">🗳️</div>
          <p style="color:rgba(255,255,255,.45);margin-top:.75rem">
            No hay votaciones activas en este momento.
          </p>
          <p style="color:rgba(255,255,255,.28);font-size:.8rem;margin-top:.25rem">
            ¡Vuelve pronto para participar!
          </p>
        </div>`;
      return;
    }

    container.innerHTML = '';

    snapshot.forEach(docSnap => {
      const data       = docSnap.data();
      const votacionId = docSnap.id;

      // ✅ Normalizar siempre a array
      const opciones    = normalizarOpciones(data.opciones);
      const totalVotos  = opciones.reduce((sum, opt) => sum + (opt.votos || 0), 0);
      const yaVotado    = yaVoto(votacionId);
      const fechaFin    = data.fechaFin?.toDate ? data.fechaFin.toDate() : null;
      const estaCerrada = fechaFin && fechaFin < new Date();

      /* ── Opciones HTML ── */
      let opcionesHtml = '';

      if (yaVotado || estaCerrada) {
        // Mostrar resultados con barras
        opcionesHtml = opciones.map(opt => {
          const votos      = opt.votos || 0;
          const porcentaje = totalVotos > 0 ? Math.round(votos / totalVotos * 100) : 0;
          return `
            <div style="margin-bottom:.9rem">
              <div style="display:flex;justify-content:space-between;margin-bottom:.32rem">
                <span style="font-size:.88rem;color:rgba(255,255,255,.82)">${sanitize(opt.texto)}</span>
                <span style="font-family:'Fira Code',monospace;font-size:.8rem;color:#00c8f0">
                  ${votos} (${porcentaje}%)
                </span>
              </div>
              <div style="background:rgba(255,255,255,.07);border-radius:99px;height:7px;overflow:hidden">
                <div style="background:linear-gradient(90deg,#00c8f0,#8b5cf6);
                            width:${porcentaje}%;height:100%;border-radius:99px;
                            transition:width .6s ease"></div>
              </div>
            </div>`;
        }).join('');
      } else {
        // Botones interactivos para votar
        opcionesHtml = opciones.map((opt, idx) => `
          <button class="btn-votar-op"
                  data-id="${votacionId}"
                  data-index="${idx}"
                  data-texto="${sanitize(opt.texto)}"
                  style="display:flex;align-items:center;gap:10px;width:100%;
                         margin-bottom:.5rem;padding:11px 14px;
                         background:rgba(0,200,240,.05);
                         border:1px solid rgba(0,200,240,.18);border-radius:12px;
                         color:rgba(255,255,255,.82);font-size:.88rem;font-weight:500;
                         cursor:pointer;transition:all .2s ease;
                         font-family:inherit;text-align:left">
            <span style="width:18px;height:18px;border-radius:50%;
                         border:2px solid rgba(0,200,240,.35);flex-shrink:0;
                         transition:all .2s ease"></span>
            ${sanitize(opt.texto)}
          </button>`).join('');
      }

      /* ── Badge de estado ── */
      let estadoHtml = '';
      if (estaCerrada) {
        estadoHtml = `<span style="flex-shrink:0;padding:4px 10px;
          background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);
          border-radius:99px;font-size:.68rem;color:rgba(255,255,255,.5);
          font-family:'Fira Code',monospace">🔒 Cerrada</span>`;
      } else if (yaVotado) {
        estadoHtml = `<span style="flex-shrink:0;padding:4px 10px;
          background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);
          border-radius:99px;font-size:.68rem;color:#34d399;
          font-family:'Fira Code',monospace">✓ Ya votaste</span>`;
      } else if (fechaFin) {
        const dias = Math.ceil((fechaFin - new Date()) / 86400000);
        if (dias > 0) estadoHtml = `<span style="flex-shrink:0;padding:4px 10px;
          background:rgba(0,200,240,.1);border:1px solid rgba(0,200,240,.25);
          border-radius:99px;font-size:.68rem;color:#33d6f5;
          font-family:'Fira Code',monospace">⏰ ${dias}d restantes</span>`;
      } else {
        estadoHtml = `<span style="flex-shrink:0;display:inline-flex;align-items:center;gap:5px;
          padding:4px 10px;background:rgba(16,185,129,.12);
          border:1px solid rgba(16,185,129,.25);border-radius:99px;
          font-size:.68rem;color:#34d399;font-family:'Fira Code',monospace">
          <span style="width:6px;height:6px;border-radius:50%;background:#10b981;
                       animation:blink 2s infinite"></span>En vivo
        </span>`;
      }

      /* ── Card completa ── */
      const card = document.createElement('div');
      card.className = 'card reveal';
      card.style.cssText = `
        background:rgba(10,22,40,.88);
        border:1px solid rgba(0,200,240,.18);
        border-radius:20px;overflow:hidden;
        transition:border-color .25s,transform .25s,box-shadow .25s`;

      card.innerHTML = `
        <div style="height:2px;background:linear-gradient(90deg,#00c8f0,#8b5cf6)"></div>
        <div style="padding:1.5rem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;
                      margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
            <div style="flex:1">
              <div style="font-size:.68rem;font-family:'Fira Code',monospace;
                          letter-spacing:.1em;text-transform:uppercase;
                          color:${yaVotado ? '#a78bfa' : '#00c8f0'};margin-bottom:.3rem">
                ${yaVotado ? 'Ya participaste' : 'Votación activa'}
              </div>
              <h3 style="margin:0;font-size:1.05rem;color:#fff;line-height:1.3">
                ${sanitize(data.pregunta)}
              </h3>
              ${data.descripcion
                ? `<p style="color:rgba(255,255,255,.45);font-size:.82rem;margin-top:.35rem">
                     ${sanitize(data.descripcion)}
                   </p>`
                : ''}
            </div>
            ${estadoHtml}
          </div>

          <div id="opts-wrap-${votacionId}">
            ${opcionesHtml}
          </div>

          <div style="margin-top:1rem;padding-top:.85rem;
                      border-top:1px solid rgba(255,255,255,.07);
                      display:flex;justify-content:space-between;
                      font-size:.72rem;color:rgba(255,255,255,.3);
                      font-family:'Fira Code',monospace">
            <span>👥 ${totalVotos} voto${totalVotos !== 1 ? 's' : ''} totales</span>
            <span>📅 ${formatDate(data.fechaCreacion)}</span>
          </div>
        </div>`;

      container.appendChild(card);
      requestAnimationFrame(() => card.classList.add('visible'));

      /* ── Interactividad (solo si puede votar) ── */
      if (!yaVotado && !estaCerrada) {
        card.querySelectorAll('.btn-votar-op').forEach(btn => {
          btn.addEventListener('mouseenter', () => {
            if (!btn.classList.contains('sel')) {
              btn.style.background  = 'rgba(0,200,240,.1)';
              btn.style.borderColor = 'rgba(0,200,240,.45)';
            }
          });
          btn.addEventListener('mouseleave', () => {
            if (!btn.classList.contains('sel')) {
              btn.style.background  = 'rgba(0,200,240,.05)';
              btn.style.borderColor = 'rgba(0,200,240,.18)';
            }
          });

          btn.addEventListener('click', () => {
            const id    = btn.dataset.id;
            const idx   = parseInt(btn.dataset.index);
            const texto = btn.dataset.texto;

            // Deseleccionar todos
            card.querySelectorAll('.btn-votar-op').forEach(b => {
              b.classList.remove('sel');
              b.style.background  = 'rgba(0,200,240,.05)';
              b.style.borderColor = 'rgba(0,200,240,.18)';
              b.style.fontWeight  = '500';
              b.style.boxShadow   = 'none';
              const dot = b.querySelector('span');
              if (dot) { dot.style.background = 'transparent'; dot.style.boxShadow = 'none'; }
            });

            // Seleccionar este
            btn.classList.add('sel');
            btn.style.background  = 'rgba(0,200,240,.1)';
            btn.style.borderColor = '#00c8f0';
            btn.style.fontWeight  = '600';
            btn.style.boxShadow   = '0 0 16px rgba(0,200,240,.15)';
            const dot = btn.querySelector('span');
            if (dot) {
              dot.style.background  = '#00c8f0';
              dot.style.borderColor = '#00c8f0';
              dot.style.boxShadow   = '0 0 8px rgba(0,200,240,.5)';
            }

            // Crear/actualizar botón confirmar
            const wrap = card.querySelector(`#opts-wrap-${id}`);
            let confirmBtn = card.querySelector('.btn-confirmar-final');
            if (!confirmBtn) {
              confirmBtn = document.createElement('button');
              confirmBtn.className  = 'btn-confirmar-final';
              confirmBtn.style.cssText = `
                width:100%;margin-top:.75rem;padding:12px;
                background:linear-gradient(135deg,#00a3c4,#00c8f0);
                border:none;border-radius:12px;color:#04080F;
                font-weight:700;font-size:.9rem;cursor:pointer;
                letter-spacing:.02em;font-family:inherit;
                transition:all .2s ease`;
              wrap.after(confirmBtn);
            }
            confirmBtn.textContent = `Votar por "${texto}"`;

            // Al confirmar
            confirmBtn.onclick = async () => {
              confirmBtn.disabled    = true;
              confirmBtn.textContent = 'Registrando…';
              const ok = await registrarVoto(id, idx, texto);
              if (!ok) {
                confirmBtn.disabled    = false;
                confirmBtn.textContent = `Votar por "${texto}"`;
              }
              // El onSnapshot se encarga de actualizar la card automáticamente
            };
          });
        });
      }
    });

  }, (error) => {
    console.error('Error cargando votaciones:', error);
    container.innerHTML = `
      <div style="text-align:center;padding:2rem;color:rgba(244,63,94,.7);font-size:.88rem">
        ⚠️ Error al cargar: ${error.message}
      </div>`;
  });
}

/* ─── Para la página pública de votaciones (votaciones.html) ─── */
export async function loadRecentVotaciones(container, count = 3) {
  if (!container) return;
  try {
    const q    = query(collection(db, COL), where('activa', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) { container.innerHTML = ''; return; }
    container.innerHTML = '';
    let i = 0;
    snap.forEach(d => {
      if (i++ >= count) return;
      const data = d.data();
      const card = document.createElement('div');
      card.className = 'card vote-card reveal';
      const opciones = normalizarOpciones(data.opciones);
      const total    = opciones.reduce((s, o) => s + (o.votos || 0), 0);
      card.innerHTML = `
        <div class="vote-question">${sanitize(data.pregunta)}</div>
        <div class="vote-meta">
          <span class="vote-total">👥 ${total} votos</span>
        </div>`;
      container.appendChild(card);
    });
  } catch (e) { console.error(e); }
}