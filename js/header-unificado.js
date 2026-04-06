// js/header-unificado.js
import { onAuthChange } from './auth-unificado.js';

// Detecta si estamos en GitHub Pages o local
function getBasePath() {
  // Si estamos en GitHub Pages (el path contiene el nombre del repo)
  if (window.location.hostname.includes('github.io')) {
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length > 1 && pathParts[1]) {
      return '/' + pathParts[1] + '/';
    }
  }
  return '/';
}

export async function loadHeader() {
  const headerPlaceholder = document.getElementById('header-placeholder');
  if (!headerPlaceholder) return;
  
  if (document.querySelector('.site-header')) return;
  
  try {
    // Intenta cargar desde componentes
    const basePath = getBasePath();
    const response = await fetch(`${basePath}components/header.html`);
    
    if (!response.ok) throw new Error('Header no encontrado');
    
    const headerHTML = await response.text();
    headerPlaceholder.innerHTML = headerHTML;
    
    // Ajustar todos los enlaces del header para GitHub Pages
    ajustarEnlacesParaGitHub();
    
    onAuthChange();
    setupMobileMenu();
    
  } catch (error) {
    console.warn('Error loading header from file, usando fallback:', error);
    headerPlaceholder.innerHTML = getHeaderFallback();
    ajustarEnlacesParaGitHub();
    onAuthChange();
    setupMobileMenu();
  }
}

function ajustarEnlacesParaGitHub() {
  // Si estamos en GitHub Pages, ajustar todos los enlaces
  if (window.location.hostname.includes('github.io')) {
    const repoName = window.location.pathname.split('/')[1];
    const allLinks = document.querySelectorAll('.nav-link, .feature-link, .btn, .footer-links a');
    
    allLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#') && href !== 'javascript:void(0)') {
        // Si el enlace ya tiene el repo name, no lo dupliques
        if (!href.startsWith(`/${repoName}`)) {
          link.setAttribute('href', `/${repoName}/${href}`);
        }
      }
    });
  }
}

function setupMobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    // Remove old listener to avoid duplicates
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    
    newToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      newToggle.classList.toggle('open');
    });
  }
}

function getHeaderFallback() {
  return `
    <header class="site-header">
      <div class="container nav-inner">
        <a href="index.html" class="nav-logo">
          <div class="nav-logo-icon">🎓</div>
          <div class="nav-logo-text">
            <span class="nav-logo-name">Consejo Estudiantil</span>
            <span class="nav-logo-sub">Instituto Pedagógico</span>
          </div>
        </a>
        <nav class="nav-links" id="nav-links">
          <a href="index.html" class="nav-link">Inicio</a>
          <a href="noticias.html" class="nav-link">Noticias</a>
          <a href="eventos.html" class="nav-link">Eventos</a>
          <a href="propuestas.html" class="nav-link">Propuestas</a>
          <a href="votaciones.html" class="nav-link">Votaciones</a>
          <a href="contacto.html" class="nav-link">Contacto</a>
          <div id="auth-button-container"></div>
        </nav>
        <button class="nav-toggle" id="nav-toggle" aria-label="Menú" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
  `;
}