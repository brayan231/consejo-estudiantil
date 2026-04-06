// js/propuestas.js
import { db } from './firebase-config.js';
import { 
  collection, addDoc, updateDoc, doc, getDoc,
  query, orderBy, onSnapshot, serverTimestamp,
  increment, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { auth } from './firebase-config.js';
import { toastSuccess, toastError } from './ui.js';

// Inicializar formulario de propuestas
export function initProposalForm(form) {
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const titulo = form.querySelector('[name="titulo"]').value;
    const autor = form.querySelector('[name="autor"]').value || 'Anónimo';
    const carrera = form.querySelector('[name="carrera"]').value || 'No especificada';
    const categoria = form.querySelector('[name="categoria"]').value;
    const contenido = form.querySelector('[name="contenido"]').value;
    
    if (!titulo || !categoria || !contenido) {
      toastError('Error', 'Por favor completa los campos obligatorios');
      return;
    }
    
    try {
      // Obtener usuario actual si está autenticado
      const user = auth.currentUser;
      const userId = user?.uid || null;
      const userEmail = user?.email || null;
      
      const propuesta = {
        titulo,
        autor,
        carrera,
        categoria,
        contenido,
        estado: 'Pendiente',
        fechaCreacion: serverTimestamp(),
        // Sistema de votación
        votos: 0,
        votosPositivos: 0,
        votosNegativos: 0,
        usuariosVotaron: [], // Array de IDs de usuarios que votaron
        votosDetalle: {}, // Objeto con el voto de cada usuario: { userId: 'positivo' o 'negativo' }
        userId: userId,
        userEmail: userEmail
      };
      
      await addDoc(collection(db, 'propuestas'), propuesta);
      toastSuccess('¡Propuesta enviada!', 'Tu propuesta ha sido registrada correctamente');
      form.reset();
      
      // Actualizar contador de caracteres
      const counter = document.getElementById('counter-contenido');
      if (counter) counter.textContent = '0 / 1000';
      
    } catch (error) {
      console.error('Error al enviar propuesta:', error);
      toastError('Error', 'No se pudo enviar la propuesta');
    }
  });
}

// Cargar propuestas públicas con sistema de votación
export function loadPublicPropuestas(container) {
  if (!container) return;
  
  const q = query(collection(db, 'propuestas'), orderBy('fechaCreacion', 'desc'));
  
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      container.innerHTML = `
        <div style="text-align:center;padding:3rem;background:rgba(10,22,40,0.88);border-radius:16px;border:1px solid rgba(0,200,240,0.12)">
          <div style="font-size:3rem;margin-bottom:1rem">💡</div>
          <p style="color:#94a3b8">No hay propuestas aún. ¡Sé el primero en compartir una idea!</p>
        </div>`;
      return;
    }
    
    container.innerHTML = snapshot.docs.map(doc => {
      const data = doc.data();
      const propuestaId = doc.id;
      const fecha = data.fechaCreacion?.toDate() || new Date();
      const estadoColor = {
        'Pendiente': 'gold',
        'Aprobada': 'green',
        'Rechazada': 'red'
      }[data.estado] || 'gray';
      
      // Datos de votación
      const votosPositivos = data.votosPositivos || 0;
      const votosNegativos = data.votosNegativos || 0;
      const totalVotos = votosPositivos + votosNegativos;
      const porcentajePositivo = totalVotos > 0 ? Math.round((votosPositivos / totalVotos) * 100) : 0;
      
      // Verificar si el usuario actual ya votó
      const currentUser = auth.currentUser;
      let userVoto = null;
      if (currentUser && data.votosDetalle && data.votosDetalle[currentUser.uid]) {
        userVoto = data.votosDetalle[currentUser.uid];
      }
      
      return `
        <div class="proposal-card" data-propuesta-id="${propuestaId}" style="animation:fadeIn 0.3s ease">
          <div class="proposal-card-header">
            <div>
              <div class="proposal-card-title">${escapeHtml(data.titulo)}</div>
              <div class="text-muted" style="font-size:0.75rem">
                Por ${escapeHtml(data.autor)} · ${escapeHtml(data.carrera)} · 
                ${fecha.toLocaleDateString('es-PE')}
              </div>
            </div>
            <span class="badge badge-${estadoColor}">${data.estado}</span>
          </div>
          
          <div class="proposal-card-body">
            <div style="margin-bottom:0.75rem">
              <span class="badge badge-blue">${escapeHtml(data.categoria)}</span>
            </div>
            <p style="line-height:1.6">${escapeHtml(data.contenido)}</p>
          </div>
          
          <!-- SISTEMA DE VOTACIÓN -->
          <div class="proposal-card-footer" style="flex-direction:column;align-items:stretch">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
              <div style="display:flex;gap:0.75rem">
                <button class="btn btn-sm ${userVoto === 'positivo' ? 'btn-success' : 'btn-outline'}" 
                        onclick="window.votarPropuesta('${propuestaId}', 'positivo')" 
                        ${!auth.currentUser ? 'disabled title="Inicia sesión para votar"' : ''}>
                  👍 ${votosPositivos > 0 ? votosPositivos : ''} A favor
                </button>
                <button class="btn btn-sm ${userVoto === 'negativo' ? 'btn-danger' : 'btn-outline'}" 
                        onclick="window.votarPropuesta('${propuestaId}', 'negativo')"
                        ${!auth.currentUser ? 'disabled title="Inicia sesión para votar"' : ''}>
                  👎 ${votosNegativos > 0 ? votosNegativos : ''} En contra
                </button>
              </div>
              <div class="text-muted" style="font-size:0.7rem">
                ${totalVotos} voto${totalVotos !== 1 ? 's' : ''} • 
                ${porcentajePositivo}% a favor
              </div>
            </div>
            
            <!-- Barra de porcentaje -->
            <div style="background:rgba(255,255,255,0.1);border-radius:99px;height:6px;overflow:hidden">
              <div style="background:linear-gradient(90deg,#10b981,#34d399);width:${porcentajePositivo}%;height:100%;border-radius:99px"></div>
            </div>
            
            ${!auth.currentUser ? `
              <div class="alert info" style="margin-top:0.75rem;padding:0.5rem;font-size:0.75rem">
                🔐 Inicia sesión para votar por esta propuesta
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  });
}

// Función global para votar
window.votarPropuesta = async (propuestaId, tipoVoto) => {
  const user = auth.currentUser;
  if (!user) {
    toastError('Acceso denegado', 'Debes iniciar sesión para votar');
    // Redirigir al login o mostrar modal
    setTimeout(() => {
      if (confirm('¿Quieres iniciar sesión para votar?')) {
        window.location.href = 'login.html';
      }
    }, 500);
    return;
  }
  
  try {
    const propuestaRef = doc(db, 'propuestas', propuestaId);
    const propuestaDoc = await getDoc(propuestaRef);
    
    if (!propuestaDoc.exists()) {
      toastError('Error', 'Propuesta no encontrada');
      return;
    }
    
    const data = propuestaDoc.data();
    const votosDetalle = data.votosDetalle || {};
    const votoAnterior = votosDetalle[user.uid];
    
    // Preparar actualizaciones
    let updateData = {};
    
    if (votoAnterior === tipoVoto) {
      // Retirar voto
      if (tipoVoto === 'positivo') {
        updateData = {
          votosPositivos: increment(-1),
          votos: increment(-1)
        };
      } else {
        updateData = {
          votosNegativos: increment(-1),
          votos: increment(-1)
        };
      }
      delete votosDetalle[user.uid];
      updateData.votosDetalle = votosDetalle;
      toastSuccess('Voto retirado', 'Has retirado tu voto');
      
    } else {
      // Cambiar o agregar voto
      if (votoAnterior === 'positivo') {
        updateData.votosPositivos = increment(-1);
        updateData.votosNegativos = increment(1);
      } else if (votoAnterior === 'negativo') {
        updateData.votosPositivos = increment(1);
        updateData.votosNegativos = increment(-1);
      } else {
        // Voto nuevo
        if (tipoVoto === 'positivo') {
          updateData.votosPositivos = increment(1);
        } else {
          updateData.votosNegativos = increment(1);
        }
        updateData.votos = increment(1);
      }
      
      votosDetalle[user.uid] = tipoVoto;
      updateData.votosDetalle = votosDetalle;
      
      toastSuccess('Voto registrado', `Has votado ${tipoVoto === 'positivo' ? 'a favor' : 'en contra'} de esta propuesta`);
    }
    
    await updateDoc(propuestaRef, updateData);
    
  } catch (error) {
    console.error('Error al votar:', error);
    toastError('Error', 'No se pudo registrar el voto');
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}


