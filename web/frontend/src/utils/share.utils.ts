/**
 * Utilidad premium para compartir una campaña de crowdfunding.
 * Usa navigator.share en dispositivos móviles o copia el enlace con fallback premium.
 */

export function shareCampaignUrl(campaignId: string, campaignTitle: string) {
  const shareUrl = `${window.location.origin}/campaign/${campaignId}`;
  const shareTitle = campaignTitle || 'Campaña de Crowdfunding';
  const shareText = `¡Mira esta increíble campaña en Elingeyes!: ${shareTitle} 🚀`;

  if (navigator.share) {
    navigator
      .share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      })
      .catch((err) => {
        // En caso de que se cancele la compartición, no hacemos nada o disparamos un log silencioso
        console.debug('navigator.share cancelado o fallido:', err);
      });
  } else {
    // Fallback: Copiar al portapapeles
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        showShareToast('¡Enlace de campaña copiado al portapapeles! 🚀', 'success');
      })
      .catch(() => {
        showShareToast('No se pudo copiar el enlace. Intenta de nuevo.', 'error');
      });
  }
}

/**
 * Muestra una notificación tipo Toast premium y flotante con animaciones CSS.
 */
function showShareToast(message: string, type: 'success' | 'error') {
  // Eliminar cualquier toast activo para evitar acumulación en la pantalla
  const activeToasts = document.querySelectorAll('.blingeyes-share-toast');
  activeToasts.forEach((t) => t.remove());

  const toast = document.createElement('div');
  toast.className = 'blingeyes-share-toast';
  
  // Estilo premium: glassmorphism, sombras pronunciadas y transiciones fluidas
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translate(-50%, 20px)',
    opacity: '0',
    backgroundColor: 'rgba(28, 43, 30, 0.95)',
    backdropFilter: 'blur(12px)',
    border: type === 'success' ? '1px solid rgba(46, 125, 50, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '16px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontSize: '13px',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    zIndex: '9999',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  });

  const icon = document.createElement('span');
  icon.innerHTML = type === 'success' ? '✓' : '⚠';
  Object.assign(icon.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: type === 'success' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
    color: type === 'success' ? '#4ade80' : '#f87171',
    fontWeight: 'bold',
    fontSize: '11px',
  });

  const textNode = document.createTextNode(message);

  toast.appendChild(icon);
  toast.appendChild(textNode);
  document.body.appendChild(toast);

  // Animación de entrada
  requestAnimationFrame(() => {
    setTimeout(() => {
      toast.style.transform = 'translate(-50%, 0)';
      toast.style.opacity = '1';
    }, 10);
  });

  // Animación de salida
  setTimeout(() => {
    toast.style.transform = 'translate(-50%, 20px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 2800);
}
