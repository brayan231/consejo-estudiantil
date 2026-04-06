// ============================================================
//  firebase-config.js — Configuración y exports de Firebase
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWNOOZwpE8Vn3pSl4XWOnUPBqDiQ4Vz0Q",
  authDomain: "coes-a112f.firebaseapp.com",  // ✅ Esto funciona en GitHub Pages
  projectId: "coes-a112f",
  storageBucket: "coes-a112f.firebasestorage.app",
  messagingSenderId: "449833014686",
  appId: "1:449833014686:web:1ba7cac41387d9fd38b28f",
  measurementId: "G-Y24SH5D2PN"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { app, auth, db, storage, analytics, googleProvider };