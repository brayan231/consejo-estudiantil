// ============================================================
//  user-menu.js — Menú de usuario simple
// ============================================================

import { auth, db } from './firebase-config.js';
import { 
  signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { toastSuccess, toastError } from './ui.js';

const provider = new GoogleAuthProvider();

export function initUserMenu() {
  const container = document.getElementById('user-menu-container');
  if (!container) return;

  // Verificar estado de autenticación
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Usuario logueado
      container.innerHTML = `
        <div style="position:relative">
          <button id="userBtn" style="display:flex;align-items:center;gap:8px;background:rgba(0,200,240,0.1);border:1px solid rgba(0,200,240,0.3);border-radius:40px;padding:5px 12px;cursor:pointer;color:white">
            <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + user.displayName}" style="width:28px;height:28px;border-radius:50%">
            <span>${user.displayName?.split(' ')[0] || 'Usuario'}</span>
          </button>
          <div id="userDropdown" style="display:none;position:absolute;top:100%;right:0;margin-top:8px;background:#0f172a;border:1px solid rgba(0,200,240,0.2);border-radius:16px;padding:10px;min-width:180px;z-index:1000">
            <div style="padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1)">
              <strong style="color:white">${user.displayName}</strong><br>
              <small style="color:rgba(255,255,255,0.5)">${user.email}</small>
            </div>
            <button id="logoutBtn" style="width:100%;background:rgba(239,68,68,0.15);border:none;padding:8px;border-radius:10px;color:#f87171;cursor:pointer">🚪 Cerrar sesión</button>
          </div>
        </div>
      `;
      
      const userBtn = document.getElementById('userBtn');
      const userDropdown = document.getElementById('userDropdown');
      if (userBtn && userDropdown) {
        userBtn.onclick = (e) => {
          e.stopPropagation();
          userDropdown.style.display = userDropdown.style.display === 'none' ? 'block' : 'none';
        };
        document.onclick = () => userDropdown.style.display = 'none';
      }
      
      document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await signOut(auth);
        toastSuccess('Sesión cerrada', 'Hasta luego');
      });
      
    } else {
      // Usuario no logueado
      container.innerHTML = `
        <button id="loginBtn" style="background:linear-gradient(135deg,#4285f4,#34a853);border:none;border-radius:40px;padding:6px 16px;color:white;font-weight:600;cursor:pointer">🔐 Ingresar</button>
      `;
      
      document.getElementById('loginBtn')?.addEventListener('click', async () => {
        try {
          const result = await signInWithPopup(auth, provider);
          const user = result.user;
          
          const userRef = doc(db, 'usuarios', user.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              nombre: user.displayName,
              email: user.email,
              foto: user.photoURL,
              fechaRegistro: new Date(),
              votos: []
            });
          }
          toastSuccess('Bienvenido', `${user.displayName}`);
        } catch (error) {
          toastError('Error', 'No se pudo iniciar sesión');
        }
      });
    }
  });
}