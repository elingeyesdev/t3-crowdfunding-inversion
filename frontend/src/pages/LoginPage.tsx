import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { login } from '../api/investor.api';
import { persistUserRoleFromServer } from '../utils/authRole';
import { AlertCircle, ArrowRight, CheckCircle2, Mail, Lock, Rocket, Shield, TrendingUp, Eye, EyeOff } from 'lucide-react';

const GOOGLE_OAUTH_URL = '/api/v1/auth/google?role=investor';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
      <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
      <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
    </svg>
  );
}

// Brand colors
const GREEN = '#72B626';
const GREEN_DARK = '#4a7f1a';
// const UNI = '#8B1938'; // available if needed

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectTo = (location.state as any)?.from || null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    if (searchParams.get('error') === 'oauth') {
      setError('No se pudo autenticar con Google. Intenta de nuevo.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await login({ email, password });
      
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('userEmail', response.user?.email ?? email);
      if (response.user?.id) localStorage.setItem('userId', response.user.id);

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      const adminAccessLevel = response.user?.adminAccessLevel;
      if (adminAccessLevel) {
        localStorage.setItem('adminAccessLevel', adminAccessLevel);
        if (adminAccessLevel === 'super_admin') {
          navigate('/superadmin');
        } else {
          navigate('/admin');
        }
        return;
      }

      const appRole = persistUserRoleFromServer(response.user?.roles);

      if (redirectTo) {
        navigate(redirectTo);
        return;
      }

      if (appRole === 'entrepreneur') {
        navigate('/entrepreneur-profile');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Credenciales incorrectas.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* ── Columna Izquierda: Formulario ── */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 py-12">
        <div className="w-full max-w-[400px] mx-auto">

          {/* Logo */}
          <Link to="/" className="inline-flex items-center mb-10 no-underline" style={{ textDecoration: 'none' }}>
            <img
              src="/logocrowd.jpg"
              alt="Unifundme"
              className="h-12 w-auto object-contain"
            />
          </Link>

          <h1 className="text-[28px] font-bold text-gray-900 mb-1.5 leading-tight">
            Inicia sesión
          </h1>
          <p className="text-[15px] text-gray-500 mb-8">
            Gestiona tus proyectos y donaciones.
          </p>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-sm font-medium mb-6 flex items-center gap-2.5">
              <AlertCircle size={18} strokeWidth={2} className="shrink-0 text-red-500" />
              <p>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[13px] font-semibold text-gray-700">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={2} />
                <input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 bg-white text-[15px] text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:border-[#72B626] focus:ring-3 focus:ring-[#72B626]/10"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[13px] font-semibold text-gray-700">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={2} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-300 bg-white text-[15px] text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:border-[#72B626] focus:ring-3 focus:ring-[#72B626]/10"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors bg-transparent border-none cursor-pointer p-0"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4.5 h-4.5 appearance-none border-2 border-gray-300 rounded checked:border-[#72B626] checked:bg-[#72B626] transition-all cursor-pointer peer"
                />
                <CheckCircle2 size={12} strokeWidth={3} className="text-white absolute left-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 transition-all" />
              </div>
              <label htmlFor="rememberMe" className="text-[13px] text-gray-600 cursor-pointer select-none">
                Recordar mi correo
              </label>
            </div>

            <button
              id="btn-login"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white text-[15px] font-semibold cursor-pointer transition-all flex items-center justify-center gap-2.5 border-none mt-1"
              style={{
                background: GREEN,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                opacity: loading ? 0.8 : 1,
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = GREEN_DARK; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = GREEN; }}
            >
              {loading ? (
                <>
                  <div className="w-4.5 h-4.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <span>Ingresar</span>
                  <ArrowRight size={17} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Separador OR */}
          <div className="flex items-center gap-3 mt-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[12px] text-gray-400 font-medium">o continúa con</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Botón Google */}
          <a
            href={GOOGLE_OAUTH_URL}
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl border border-gray-300 bg-white text-[14px] font-semibold text-gray-700 mt-3 cursor-pointer transition-all no-underline"
            style={{ textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#9CA3AF')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#D1D5DB')}
          >
            <GoogleIcon />
            <span>Continuar con Google</span>
          </a>

          {/* Register link */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <span className="text-[14px] text-gray-500">¿Eres nuevo? </span>
            <Link
              to="/register"
              className="text-[14px] font-semibold no-underline"
              style={{ color: GREEN, textDecoration: 'none' }}
            >
              Crear una cuenta
            </Link>
          </div>

        </div>
      </div>

      {/* ── Columna Derecha: Ilustración visual ── */}
      <div
        className="hidden lg:flex w-[55%] flex-col items-center justify-center p-16 relative overflow-hidden"
        style={{ background: '#f7f9f7' }}
      >
        {/* Patrón de puntos sutil */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle, ${GREEN}33 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />

        <div className="w-full max-w-[400px] relative z-10">
          
          {/* Headline */}
          <div className="mb-8">
            <span className="inline-block px-3 py-1 rounded-full text-[12px] font-semibold bg-white border border-gray-200 mb-4" style={{ color: GREEN_DARK }}>
              ✓ Proyectos verificados
            </span>
            <h2 className="text-[32px] font-bold text-gray-900 leading-tight mb-3">
              Descubre proyectos que generan impacto real.
            </h2>
            <p className="text-[15px] text-gray-500 leading-relaxed">
              Invierte en campañas de emprendedores bolivianos con propósito y respaldo comunitario.
            </p>
          </div>

          {/* Key pillars instead of the card */}
          <div className="flex flex-col gap-6 my-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-100 shadow-sm shrink-0">
                <Rocket size={18} className="text-[#72B626]" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-gray-900">Impulsa proyectos reales</h4>
                <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">Conéctate con startups, proyectos ecológicos y de impacto social listos para escalar.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-100 shadow-sm shrink-0">
                <Shield size={18} className="text-[#72B626]" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-gray-900">Seguridad y Confianza</h4>
                <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">Verificación de identidad KYC y transacciones auditadas con total transparencia.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-100 shadow-sm shrink-0">
                <TrendingUp size={18} className="text-[#72B626]" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-gray-900">Progreso y Metas</h4>
                <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">Accede a métricas transparentes e informes del progreso de tus donaciones.</p>
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex items-center gap-4 mt-8 pt-6 border-t border-gray-200">
            {['Seguro', 'Transparente', 'Verificado'].map(t => (
              <div key={t} className="flex items-center gap-1.5 text-[12px] text-gray-500 font-medium">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} />
                {t}
              </div>
            ))}
          </div>

        </div>
      </div>

    </div>
  );
}
