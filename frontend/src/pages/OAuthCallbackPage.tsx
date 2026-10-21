import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { persistUserRoleFromServer } from '../utils/authRole';

const GREEN = '#72B626';

function parseJwtPayload(token: string): { sub?: string; email?: string } {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const token = searchParams.get('token');
    const userId = searchParams.get('userId');
    const role = searchParams.get('role') as 'investor' | 'entrepreneur' | null;
    const oauthError = searchParams.get('error');

    if (oauthError || !token) {
      navigate('/login?error=oauth', { replace: true });
      return;
    }

    // Guardar token y datos del usuario
    localStorage.setItem('accessToken', token);
    if (userId) localStorage.setItem('userId', userId);

    // Decodificar email del JWT sin verificación (ya verificado por el backend)
    const payload = parseJwtPayload(token);
    if (payload.email) localStorage.setItem('userEmail', payload.email);

    const appRole = persistUserRoleFromServer([role ?? 'investor'], role ?? 'investor');

    if (appRole === 'entrepreneur') {
      navigate('/entrepreneur-profile', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 44,
            height: 44,
            border: `3px solid ${GREEN}30`,
            borderTopColor: GREEN,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 20px',
          }}
        />
        <p style={{ color: '#6B7280', fontSize: 15, margin: 0 }}>
          Iniciando sesión con Google...
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
