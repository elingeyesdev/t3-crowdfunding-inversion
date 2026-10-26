import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { login } from '../api/investor.api';
import { persistUserRoleFromServer } from '../utils/authRole';
import { AlertCircle, ArrowRight, CheckCircle2, Mail, Lock, TrendingUp, DollarSign } from 'lucide-react';

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
const UNI = '#8B1938';

const registerApi = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'investor' | 'entrepreneur'>('investor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await registerApi.post('/users/register', { email, password, preferredLanguage: 'es', signupRole: role });
      const response = await login({ email, password });
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('userId', response.user.id);
      localStorage.setItem('userEmail', response.user?.email ?? email);
      persistUserRoleFromServer(response.user?.roles, role);
      if (role === 'entrepreneur') navigate('/entrepreneur-profile');
      else navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al registrar el usuario.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const isInvestor = role === 'investor';

  return (
    <div className="min-h-screen bg-white flex">
      {/* Columna izquierda */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 py-12">
        <div className="w-full max-w-[420px] mx-auto">

          {/* Logo */}
          <Link to="/" className="inline-flex items-center mb-10" style={{ textDecoration: 'none' }}>
            <img src="/logocrowd.jpg" alt="Unifundme" className="h-12 w-auto object-contain" />
          </Link>

          <h1 className="text-[28px] font-bold text-gray-900 mb-1.5">Crea tu cuenta</h1>
          <p className="text-[15px] text-gray-500 mb-8">Elige cómo quieres participar en la plataforma.</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-sm font-medium mb-6 flex items-center gap-2.5">
              <AlertCircle size={18} strokeWidth={2} className="shrink-0 text-red-500" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            {/* Role selector */}
            <div>
              <label className="text-[13px] font-semibold text-gray-700 mb-2.5 block">¿Cómo quieres participar?</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setRole('investor')}
                  className="relative p-4 rounded-xl border-2 text-left cursor-pointer transition-all"
                  style={{ borderColor: isInvestor ? GREEN : '#E5E7EB', background: isInvestor ? '#f5fce8' : '#fff' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                    style={{ background: isInvestor ? GREEN : '#F3F4F6' }}>
                    <DollarSign size={16} strokeWidth={2} style={{ color: isInvestor ? 'white' : '#6B7280' }} />
                  </div>
                  <p className="text-[14px] font-semibold text-gray-900">Donador</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">Donar fondos</p>
                  {isInvestor && <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: GREEN }}><CheckCircle2 size={11} strokeWidth={3} className="text-white" /></div>}
                </button>
                <button type="button" onClick={() => setRole('entrepreneur')}
                  className="relative p-4 rounded-xl border-2 text-left cursor-pointer transition-all"
                  style={{ borderColor: !isInvestor ? UNI : '#E5E7EB', background: !isInvestor ? '#fdf2f5' : '#fff' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                    style={{ background: !isInvestor ? UNI : '#F3F4F6' }}>
                    <TrendingUp size={16} strokeWidth={2} style={{ color: !isInvestor ? 'white' : '#6B7280' }} />
                  </div>
                  <p className="text-[14px] font-semibold text-gray-900">Emprendedor</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">Buscar financiamiento</p>
                  {!isInvestor && <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: UNI }}><CheckCircle2 size={11} strokeWidth={3} className="text-white" /></div>}
                </button>
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-email" className="text-[13px] font-semibold text-gray-700">Correo electrónico</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={2} />
                <input id="reg-email" type="email" placeholder="nuevo@ejemplo.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 bg-white text-[15px] text-gray-800 outline-none transition-all placeholder:text-gray-400"
                  style={{ ['--tw-ring-color' as string]: GREEN }}
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.boxShadow = `0 0 0 3px ${GREEN}18`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-password" className="text-[13px] font-semibold text-gray-700">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={2} />
                <input id="reg-password" type="password" placeholder="Mínimo 8 caracteres" value={password}
                  onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 bg-white text-[15px] text-gray-800 outline-none transition-all placeholder:text-gray-400"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.boxShadow = `0 0 0 3px ${GREEN}18`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              <p className="text-[12px] text-gray-400 mt-0.5 ml-1">Debe incluir mayúsculas y números.</p>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl text-white text-[15px] font-semibold cursor-pointer transition-all flex items-center justify-center gap-2.5 border-none mt-1"
              style={{ background: GREEN, opacity: loading ? 0.8 : 1 }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = GREEN_DARK; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = GREEN; }}>
              {loading ? (<><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>Registrando...</span></>) : (<><span>Crear cuenta</span><ArrowRight size={17} strokeWidth={2.5} /></>)}
            </button>
          </form>

          {/* Separador OR */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[12px] text-gray-400 font-medium">o regístrate con</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Botón Google */}
          <a
            href={`/api/v1/auth/google?role=${role}`}
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl border border-gray-300 bg-white text-[14px] font-semibold text-gray-700 mt-1 cursor-pointer transition-all no-underline"
            style={{ textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#9CA3AF')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#D1D5DB')}
          >
            <GoogleIcon />
            <span>Registrarse con Google como {role === 'entrepreneur' ? 'Emprendedor' : 'Donador'}</span>
          </a>

          <div className="mt-4 pt-5 border-t border-gray-100 text-center">
            <span className="text-[14px] text-gray-500">¿Ya tienes cuenta? </span>
            <Link to="/login" className="text-[14px] font-semibold" style={{ color: GREEN, textDecoration: 'none' }}>Iniciar sesión</Link>
          </div>
        </div>
      </div>

      {/* Columna derecha */}
      <div className="hidden lg:flex w-[55%] flex-col items-center justify-center p-16 relative overflow-hidden"
        style={{ background: isInvestor ? '#f5fce8' : '#fdf2f5' }}>
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle, ${isInvestor ? GREEN : UNI}33 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }} />
        <div className="w-full max-w-[380px] relative z-10">
          <span className="inline-block px-3 py-1 rounded-full text-[12px] font-semibold mb-5"
            style={{ background: 'white', color: isInvestor ? GREEN_DARK : UNI, border: `1px solid ${isInvestor ? GREEN : UNI}30` }}>
            {isInvestor ? '✓ Historial de donaciones' : '✓ Sin comisiones ocultas'}
          </span>
          <h2 className="text-[28px] font-bold text-gray-900 leading-tight mb-3">
            {isInvestor ? 'Apoya proyectos reales con tus donaciones.' : 'Tu idea merece el respaldo que necesita.'}
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-8">
            {isInvestor ? 'Accede a campañas curadas con métricas claras y transparentes.' : 'Crea tu campaña en minutos y conéctate con donantes comprometidos.'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            {isInvestor ? (
              <>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[24px] font-bold text-gray-900">Bs. 2.4M</p><p className="text-[12px] text-gray-500 mt-0.5">Donaciones totales</p></div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[24px] font-bold" style={{ color: GREEN }}>+12%</p><p className="text-[12px] text-gray-500 mt-0.5">Tasa de impacto</p></div>
              </>
            ) : (
              <>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[24px] font-bold text-gray-900">320+</p><p className="text-[12px] text-gray-500 mt-0.5">Campañas activas</p></div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[24px] font-bold" style={{ color: UNI }}>91%</p><p className="text-[12px] text-gray-500 mt-0.5">Tasa de éxito</p></div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
