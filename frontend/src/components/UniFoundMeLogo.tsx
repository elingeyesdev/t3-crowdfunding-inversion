/**
 * variant="color"  → logo a color completo, para fondos claros (default)
 * variant="white"  → logo invertido a blanco, para fondos oscuros
 * variant="icon"   → solo el ícono/engrane cuadrado, para espacios pequeños
 *
 * Tamaño: usa clases Tailwind de altura en className (h-8, h-10, sm:h-12, etc.)
 * El ancho se calcula automáticamente respetando el aspect ratio real:
 *   icon  → 1:1   (cuadrado)
 *   color → 2.34:1 (horizontal)
 *   white → 2.34:1 (horizontal)
 */
interface UniFoundMeLogoProps {
  className?: string;
  variant?: 'color' | 'white' | 'icon';
}

const SRC: Record<NonNullable<UniFoundMeLogoProps['variant']>, string> = {
  color: '/logo-color.png',
  white: '/logo-dark.png',
  icon:  '/logo-icon.png',
};

export function UniFoundMeLogo({ className = '', variant = 'color' }: UniFoundMeLogoProps) {
  return (
    <img
      src={SRC[variant]}
      alt="Unifundme"
      className={`block w-auto object-contain ${className}`}
      style={{ filter: variant === 'white' ? 'brightness(0) invert(1)' : undefined }}
    />
  );
}
