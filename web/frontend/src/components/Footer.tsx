import { Link } from 'react-router-dom';
import { UniFoundMeLogo } from './UniFoundMeLogo';
import { Lock } from 'lucide-react';

export function Footer() {
  const cols = [
    {
      title: 'Explorar',
      links: [
        { label: 'Campañas de Donación', to: '/explore?type=donation' },
        { label: 'Campañas de Recompensa', to: '/explore?type=reward' },
        { label: 'DonaTok', to: '/donatok' },
        { label: 'Categorías', to: '/explore' },
      ],
    },
    {
      title: 'Recolectar fondos',
      links: [
        { label: 'Cómo iniciar una campaña', to: '/entrepreneur-profile' },
        { label: 'Mis Campañas', to: '/entrepreneur-campaigns' },
        { label: 'Perfil Emprendedor', to: '/entrepreneur-profile' },
        { label: 'Políticas de Verificación', to: '/entrepreneur-profile' },
      ],
    },
    {
      title: 'Plataforma',
      links: [
        { label: 'Cómo funciona Unifundme', to: '/' },
        { label: 'Panel del Inversor', to: '/dashboard' },
        { label: 'Iniciar sesión', to: '/login' },
        { label: 'Registrarse', to: '/register' },
      ],
    },
  ];

  return (
    <footer className="bg-gray-900 text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="no-underline mb-4 inline-block">
              <UniFoundMeLogo variant="white" className="h-10 sm:h-11" />
            </Link>
            <p className="text-white/40 text-[13px] leading-relaxed mt-3">
              La plataforma de crowdfunding boliviana para proyectos universitarios, tecnológicos y solidarios.
            </p>
          </div>

          {/* Nav columns */}
          {cols.map(col => (
            <div key={col.title}>
              <h4 className="text-[11px] font-black text-white/30 uppercase tracking-widest mb-4">{col.title}</h4>
              <ul className="flex flex-col gap-3 list-none p-0 m-0">
                {col.links.map(l => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-white/50 hover:text-white text-[14px] font-semibold no-underline transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-7 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-[13px] font-medium">
            © 2026 Unifundme Bolivia. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-2 text-white/20 text-[12px] font-semibold">
            <Lock size={11} strokeWidth={2} /> Plataforma segura y verificada
          </div>
        </div>
      </div>
    </footer>
  );
}
