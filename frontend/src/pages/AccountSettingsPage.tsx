import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Settings,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
  LogOut,
  AlertTriangle,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { changePassword, logout } from '../api/auth.api';

/** Formatea fecha en español con hora */
function formatDate(iso: string | null): string {
  if (!iso) return 'Nunca';
  try {
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Indicador de fortaleza de contraseña */
function PasswordStrengthBar({ password }: { password: string }) {
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const score = [hasLength, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  const labels = ['', 'Muy débil', 'Débil', 'Buena', 'Fuerte'];
  const colors = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-[#72B626]'];

  if (!password) return null;

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? colors[score] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${score <= 1 ? 'text-red-500' : score === 2 ? 'text-orange-500' : score === 3 ? 'text-yellow-600' : 'text-[#72B626]'}`}>
        {password ? labels[score] : ''}
      </p>
    </div>
  );
}

/** Skeleton loader */
function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded-xl w-2/3" />
      <div className="h-4 bg-gray-100 rounded w-1/3" />
      <div className="h-40 bg-gray-100 rounded-[20px]" />
      <div className="h-56 bg-gray-100 rounded-[20px]" />
      <div className="h-24 bg-gray-100 rounded-[20px]" />
    </div>
  );
}

export function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user, loading, error: authError } = useAuth();

  // Formulario cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // Confirmación de logout
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const userRole = localStorage.getItem('userRole');
  const profilePath = userRole === 'entrepreneur' ? '/entrepreneur-profile' : '/profile';
  const profileLabel =
    userRole === 'entrepreneur' ? 'Perfil de Emprendedor' : 'Perfil de Donador';
  const profileDesc =
    userRole === 'entrepreneur'
      ? 'Gestiona tu información como emprendedor, tus campañas y datos de contacto.'
      : 'Gestiona tu información como donador, historial de inversiones y preferencias.';

  const isGoogleUser = !!user?.oauthProvider;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPwError('La nueva contraseña debe tener al menos una mayúscula y un número');
      return;
    }

    setPwLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        'Error al cambiar la contraseña. Verifica tu contraseña actual.';
      setPwError(Array.isArray(msg) ? msg.join('. ') : msg);
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
    } catch {
      // La sesión local se limpia aunque el servidor no responda.
    }
    navigate('/login');
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#72B626]/30 focus:border-[#72B626] transition-all placeholder-gray-400';

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#72B626]/10 flex items-center justify-center flex-shrink-0">
            <Settings size={22} className="text-[#72B626]" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-gray-900">Configuración de Cuenta</h1>
            {user && (
              <p className="text-[13px] text-gray-500 mt-0.5">{user.email}</p>
            )}
          </div>
        </div>

        {/* Loading / Error */}
        {loading && <Skeleton />}
        {!loading && authError && (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-[13px]">
            <XCircle size={16} />
            {authError}
          </div>
        )}

        {!loading && user && (
          <>
            {/* ── Sección Seguridad y Acceso ── */}
            <section className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#72B626]" strokeWidth={2} />
                <h2 className="text-[15px] font-semibold text-gray-800">Seguridad y Acceso</h2>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
                  Correo electrónico
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-gray-800 font-medium">{user.email}</span>
                  {user.emailVerified ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f0fae4] text-[#4a7f1a] text-[11px] font-semibold">
                      <CheckCircle size={11} strokeWidth={2.5} />
                      Verificado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-[11px] font-semibold">
                      <AlertTriangle size={11} strokeWidth={2.5} />
                      Sin verificar
                    </span>
                  )}
                </div>
              </div>

              {/* Proveedor OAuth */}
              {isGoogleUser && (
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
                    Método de acceso
                  </label>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[12px] font-semibold">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 48 48" fill="none">
                      <path d="M44.5 20H24v8.5h11.8C34.3 33.3 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l6-6C34.5 6.3 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/>
                      <path d="M6.3 14.7l7 5.1C15.2 16.2 19.3 13.5 24 13.5c3.1 0 5.9 1.1 8 3l6-6C34.5 6.3 29.6 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" fill="#FF3D00"/>
                      <path d="M24 44c5.5 0 10.4-2 14-5.2l-6.5-5.5C29.5 35.2 27 36 24 36c-5.9 0-10.9-3.8-12.7-9.1l-7 5.4C7.7 39.7 15.3 44 24 44z" fill="#4CAF50"/>
                      <path d="M44.5 20H24v8.5h11.8C34.9 31.5 32.7 33.5 30 34.8l6.5 5.5C40.9 37 44.5 31 44.5 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/>
                    </svg>
                    Cuenta Google
                  </span>
                </div>
              )}

              {/* Último acceso */}
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Clock size={11} strokeWidth={2} />
                  Último acceso
                </label>
                <p className="text-[13px] text-gray-600">{formatDate(user.lastLoginAt)}</p>
              </div>

              {/* Formulario cambio de contraseña */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-[14px] font-semibold text-gray-700 mb-4">
                  {isGoogleUser ? 'Contraseña' : 'Cambiar contraseña'}
                </h3>

                {isGoogleUser ? (
                  <p className="text-[13px] text-gray-500 bg-gray-50 rounded-xl p-3">
                    Tu cuenta usa inicio de sesión con Google. No es necesario establecer una contraseña.
                  </p>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    {/* Contraseña actual */}
                    <div className="relative">
                      <label className="block text-[12px] font-medium text-gray-600 mb-1">
                        Contraseña actual
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrent ? 'text' : 'password'}
                          className={inputClass}
                          placeholder="Tu contraseña actual"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Nueva contraseña */}
                    <div>
                      <label className="block text-[12px] font-medium text-gray-600 mb-1">
                        Nueva contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showNew ? 'text' : 'password'}
                          className={inputClass}
                          placeholder="Mínimo 8 caracteres, 1 mayúscula y 1 número"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <PasswordStrengthBar password={newPassword} />
                    </div>

                    {/* Confirmar contraseña */}
                    <div>
                      <label className="block text-[12px] font-medium text-gray-600 mb-1">
                        Confirmar nueva contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          className={inputClass}
                          placeholder="Repite la nueva contraseña"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Feedback */}
                    {pwError && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[12px]">
                        <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                        {pwError}
                      </div>
                    )}
                    {pwSuccess && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-[#f0fae4] border border-[#c3e89a] text-[#4a7f1a] text-[12px]">
                        <CheckCircle size={14} />
                        ¡Contraseña actualizada correctamente!
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={pwLoading}
                      className="w-full py-2.5 rounded-xl bg-[#72B626] hover:bg-[#4a7f1a] text-white text-[14px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {pwLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                          Actualizando…
                        </>
                      ) : (
                        'Actualizar contraseña'
                      )}
                    </button>
                  </form>
                )}
              </div>
            </section>

            {/* ── Sección Mi Perfil ── */}
            <section className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <User size={18} className="text-[#72B626]" strokeWidth={2} />
                <h2 className="text-[15px] font-semibold text-gray-800">Mi Perfil</h2>
              </div>

              <p className="text-[13px] text-gray-500 mb-4">{profileDesc}</p>

              <Link
                to={profilePath}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-[#72B626] hover:bg-[#f9fef2] transition-all group"
                style={{ textDecoration: 'none' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#72B626]/10 flex items-center justify-center">
                    <User size={15} className="text-[#72B626]" strokeWidth={2} />
                  </div>
                  <span className="text-[14px] font-medium text-gray-700 group-hover:text-[#4a7f1a]">
                    {profileLabel}
                  </span>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-[#72B626]" />
              </Link>
            </section>

            {/* ── Zona de Peligro ── */}
            <section className="bg-white rounded-[24px] border border-red-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-red-600" strokeWidth={2} />
                <h2 className="text-[15px] font-semibold text-gray-800">Zona de Peligro</h2>
              </div>

              {!logoutConfirm ? (
                <button
                  onClick={() => setLogoutConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-[14px] font-medium transition-colors cursor-pointer"
                >
                  <LogOut size={16} strokeWidth={2} />
                  Cerrar sesión
                </button>
              ) : (
                <div className="flex flex-col gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-[13px] text-red-700 font-medium">
                    ¿Estás seguro de que quieres cerrar sesión?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleLogout}
                      disabled={logoutLoading}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {logoutLoading ? (
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                      ) : (
                        <LogOut size={13} />
                      )}
                      Sí, cerrar sesión
                    </button>
                    <button
                      onClick={() => setLogoutConfirm(false)}
                      className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-[13px] font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
