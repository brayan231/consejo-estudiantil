// js/footer.js
export async function cargarFooter() {
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (!footerPlaceholder) return;
  
  try {
    const response = await fetch('components/footer.html');
    const footerHTML = await response.text();
    footerPlaceholder.innerHTML = footerHTML;
  } catch (error) {
    console.error('Error cargando footer:', error);
    // Fallback en caso de error
    footerPlaceholder.innerHTML = '<footer style="text-align:center;padding:2rem;color:#666;">© 2024 Consejo Estudiantil</footer>';
  }
}