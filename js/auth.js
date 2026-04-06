// js/auth.js
import { auth, db, googleProvider } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup,
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
  doc, setDoc, getDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const ADMIN_EMAILS = ["admin@coes.com"];

// Función para mostrar toasts
function mostrarToast(titulo, mensaje, tipo = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    `;
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  const bgColor = tipo === 'success' ? '#10b981' : tipo === 'error' ? '#ef4444' : '#00c8f0';
  toast.style.cssText = `
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    font-size: 0.875rem;
    min-width: 250px;
    max-width: 350px;
  `;
  toast.innerHTML = `<strong>${titulo}</strong><br>${mensaje}`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Agregar estilos si no existen
if (!document.querySelector('#toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export function isAdmin(user) {
  return user && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

async function saveStudentToFirestore(user) {
  const userRef = doc(db, 'estudiantes', user.uid);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      nombre: user.displayName || user.email?.split('@')[0],
      email: user.email,
      fotoURL: user.photoURL || null,
      fechaRegistro: serverTimestamp(),
      ultimoAcceso: serverTimestamp(),
      esAdmin: false,
      votosRealizados: {}
    });
  } else {
    await setDoc(userRef, { ultimoAcceso: serverTimestamp() }, { merge: true });
  }
}

// LOGIN CON EMAIL (SOLO UNA VEZ)
export async function loginWithEmail(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    if (isAdmin(user)) {
      mostrarToast('Bienvenido Admin', 'Acceso concedido', 'success');
    } else {
      await saveStudentToFirestore(user);
      mostrarToast('Bienvenido', 'Has iniciado sesión', 'success');
    }
    return user;
  } catch (error) {
    console.error('Error en login:', error);
    let mensaje = 'Credenciales incorrectas';
    if (error.code === 'auth/user-not-found') mensaje = 'Usuario no encontrado';
    if (error.code === 'auth/wrong-password') mensaje = 'Contraseña incorrecta';
    if (error.code === 'auth/invalid-email') mensaje = 'Correo electrónico inválido';
    if (error.code === 'auth/invalid-credential') mensaje = 'Usuario o contraseña incorrectos';
    mostrarToast('Error', mensaje, 'error');
    return null;
  }
}

// LOGIN CON GOOGLE
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    if (!isAdmin(user)) {
      await saveStudentToFirestore(user);
      mostrarToast('¡Bienvenido!', `Hola ${user.displayName || user.email}`, 'success');
    } else {
      mostrarToast('Bienvenido Administrador', 'Acceso concedido', 'success');
    }
    return user;
  } catch (error) {
    console.error('Error en Google:', error);
    mostrarToast('Error', 'No se pudo iniciar sesión con Google', 'error');
    return null;
  }
}

// REGISTRO
export async function registerStudent(email, password, nombre, carrera) {
  try {
    if (ADMIN_EMAILS.includes(email)) {
      mostrarToast('Error', 'Este correo está reservado para administradores', 'error');
      return null;
    }
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await setDoc(doc(db, 'estudiantes', user.uid), {
      uid: user.uid,
      nombre: nombre,
      email: email,
      carrera: carrera,
      fechaRegistro: serverTimestamp(),
      ultimoAcceso: serverTimestamp(),
      esAdmin: false,
      votosRealizados: {}
    });
    
    mostrarToast('¡Registro exitoso!', `Bienvenido ${nombre}`, 'success');
    return user;
  } catch (error) {
    console.error('Error en registro:', error);
    let mensaje = 'Error al registrar';
    if (error.code === 'auth/email-already-in-use') mensaje = 'Este correo ya está registrado';
    if (error.code === 'auth/weak-password') mensaje = 'La contraseña debe tener al menos 6 caracteres';
    mostrarToast('Error', mensaje, 'error');
    return null;
  }
}

// CERRAR SESIÓN
export async function logoutUser() {
  try {
    await signOut(auth);
    mostrarToast('Sesión cerrada', 'Hasta luego', 'success');
    setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    mostrarToast('Error', 'No se pudo cerrar sesión', 'error');
  }
}

// RENDER BOTÓN DE AUTH
export function renderAuthButton(user) {
  const container = document.getElementById('auth-button-container');
  if (!container) return;
  
  if (user) {
    const displayName = user.displayName || user.email?.split('@')[0] || 'Usuario';
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
        <span style="font-size:0.8rem;color:#94a3b8">👤 ${displayName}</span>
        <button id="btn-logout" style="background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#ef4444;padding:0.25rem 0.75rem;border-radius:9999px;font-size:0.75rem;cursor:pointer;transition:all 0.2s">
          🚪 Cerrar sesión
        </button>
      </div>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', logoutUser);
  } else {
    container.innerHTML = `
      <button id="btn-login" style="background:linear-gradient(135deg,#00c8f0,#8b5cf6);border:none;color:white;padding:0.5rem 1rem;border-radius:9999px;cursor:pointer;font-weight:500;transition:all 0.2s">
        🔑 Iniciar sesión
      </button>
    `;
    document.getElementById('btn-login')?.addEventListener('click', () => {
      window.location.href = 'login.html';
    });
  }
}

// OBTENER USUARIO ACTUAL
export function getCurrentUser() {
  return auth.currentUser;
}

// ESCUCHAR CAMBIOS DE AUTENTICACIÓN (SOLO UNA VEZ)
export function onAuthChange(callback) {
  onAuthStateChanged(auth, (user) => {
    renderAuthButton(user);
    if (callback) callback(user);
  });
}

// Función para crear admin automáticamente (ejecutar una sola vez)
export async function crearAdminSiNoExiste() {
  try {
    const adminEmail = "admin@coes.com";
    const adminPassword = "admin123";
    
    // Intentar crear el admin
    const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
    console.log('Admin creado exitosamente:', adminEmail);
    
    // Guardar en Firestore como admin
    await setDoc(doc(db, 'estudiantes', userCredential.user.uid), {
      uid: userCredential.user.uid,
      nombre: 'Administrador',
      email: adminEmail,
      esAdmin: true,
      fechaRegistro: serverTimestamp()
    });
    
    return userCredential.user;
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('El admin ya existe');
    } else {
      console.error('Error creando admin:', error);
    }
    return null;
  }
}
