import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, User, MessageCircle } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { getMyConversations } from '../api/chat.api';
import { logout } from '../api/auth.api';

interface NavbarProps {
  socket?: any;
}


export function Navbar({ socket }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const userRole = localStorage.getItem('userRole');
  const userEmail = localStorage.getItem('userEmail');

  useEffect(() => {
    if (!userEmail) return;

    const fetchUnread = async () => {
      try {
        const conversations = await getMyConversations();
        const count = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
        setUnreadCount(count);
      } catch (err: any) {
        console.error('Error fetching unread count', err);
        if (err?.response?.status === 401) {
          handleLogout();
        }
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [userEmail]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => {
      getMyConversations()
        .then(convs => setUnreadCount(convs.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)))
        .catch(() => {});
    };
    socket.on('chat_message_received', handleNewMessage);
    return () => {
      socket.off('chat_message_received', handleNewMessage);
    };
  }, [socket]);

  const handleLogout = async () => {
    try { await logout(); } catch { /* La sesión local se limpia aunque el servidor no responda. */ }
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    `text-[14px] font-medium px-3 py-1.5 rounded-md transition-colors duration-150 ${
      isActive(path)
        ? 'text-[#72B626] font-semibold'
        : 'text-gray-600 hover:text-gray-900'
    }`;

  const profilePath = userRole === 'entrepreneur' ? '/entrepreneur-profile' : '/profile';

  return (
    <>
      <nav
        className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {/* Left: Logo */}
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center no-underline group"
            style={{ textDecoration: 'none' }}
          >
            <img
              src="/logocrowd.jpg"
              alt="Unifundme"
              className="h-10 sm:h-14 w-auto object-contain"
            />
          </Link>

          {/* Nav links (Desktop) */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/explore" className={navLinkClass('/explore')} style={{ textDecoration: 'none' }}>
              Explorar
            </Link>
            <Link
              to="/donatok"
              className={`text-[14px] font-medium px-3 py-1.5 rounded-md transition-colors duration-150 ${
                isActive('/donatok') ? 'text-[#72B626] font-semibold' : 'text-gray-600 hover:text-gray-900'
              }`}
              style={{ textDecoration: 'none' }}
            >
              DonaTok
            </Link>
            {userRole === 'entrepreneur' ? (
              <>
                <Link to="/entrepreneur-campaigns" className={navLinkClass('/entrepreneur-campaigns')} style={{ textDecoration: 'none' }}>
                  Mis Campañas
                </Link>
                <Link to="/entrepreneur-profile" className={navLinkClass('/entrepreneur-profile')} style={{ textDecoration: 'none' }}>
                  Mi Perfil
                </Link>
                <Link to="/chat" className={`${navLinkClass('/chat')} relative`} style={{ textDecoration: 'none' }}>
                  <span className="flex items-center gap-1.5">
                    <MessageCircle size={15} strokeWidth={2} />
                    Mensajes
                  </span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-[#72B626] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              </>
            ) : userRole ? (
              <>
                <Link to="/dashboard" className={navLinkClass('/dashboard')} style={{ textDecoration: 'none' }}>
                  Mi Panel
                </Link>
                <Link to="/profile" className={navLinkClass('/profile')} style={{ textDecoration: 'none' }}>
                  Mi Perfil
                </Link>
                <Link to="/chat" className={`${navLinkClass('/chat')} relative`} style={{ textDecoration: 'none' }}>
                  <span className="flex items-center gap-1.5">
                    <MessageCircle size={15} strokeWidth={2} />
                    Mensajes
                  </span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-[#72B626] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              </>
            ) : null}
          </div>
        </div>

        {/* Right side (Desktop + Mobile) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User Email (Desktop) */}
          {userEmail && (
            <Link to={profilePath} className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 hover:border-[#72B626] transition-colors" style={{ textDecoration: 'none' }}>
              <div className="w-6 h-6 rounded-full bg-[#72B626]/10 flex items-center justify-center">
                <User size={13} className="text-[#72B626]" strokeWidth={2} />
              </div>
              <span className="text-[13px] font-medium text-gray-700 truncate max-w-[140px]">
                {userEmail}
              </span>
            </Link>
          )}

          {userEmail && <NotificationBell />}

          {/* Logout (Desktop) */}
          {userEmail ? (
            <button
              className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-[13px] font-medium cursor-pointer transition-colors"
              onClick={handleLogout}
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <LogOut size={15} strokeWidth={2} />
              Salir
            </button>
          ) : (
            <Link
              to="/login"
              className="hidden md:flex items-center justify-center px-4 py-1.5 rounded-lg bg-[#72B626] text-white hover:bg-[#5e9620] text-[13px] font-medium transition-colors"
              style={{ textDecoration: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Iniciar Sesión
            </Link>
          )}

          {/* Hamburger Menu Button (Mobile) */}
          <button
            className="md:hidden flex items-center justify-center p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Links Dropdown */}
      {isMenuOpen && (
        <div
          className="md:hidden bg-white border-b border-gray-200 px-4 py-4 flex flex-col gap-2.5 z-40 sticky top-[69px]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <Link
            to="/explore"
            className={`text-[15px] font-medium p-2.5 rounded-lg transition-colors ${isActive('/explore') ? 'bg-[#f5fce8] text-[#72B626] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setIsMenuOpen(false)}
            style={{ textDecoration: 'none' }}
          >
            Explorar
          </Link>
          <Link
            to="/donatok"
            className={`text-[15px] font-medium p-2.5 rounded-lg transition-colors ${isActive('/donatok') ? 'bg-[#f5fce8] text-[#72B626] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setIsMenuOpen(false)}
            style={{ textDecoration: 'none' }}
          >
            DonaTok
          </Link>

          {userRole === 'entrepreneur' ? (
            <>
              <Link
                to="/entrepreneur-campaigns"
                className={`text-[15px] font-medium p-2.5 rounded-lg transition-colors ${isActive('/entrepreneur-campaigns') ? 'bg-[#f5fce8] text-[#72B626] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setIsMenuOpen(false)}
                style={{ textDecoration: 'none' }}
              >
                Mis Campañas
              </Link>
              <Link
                to="/entrepreneur-profile"
                className={`text-[15px] font-medium p-2.5 rounded-lg transition-colors ${isActive('/entrepreneur-profile') ? 'bg-[#f5fce8] text-[#72B626] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setIsMenuOpen(false)}
                style={{ textDecoration: 'none' }}
              >
                Mi Perfil
              </Link>
              <Link
                to="/chat"
                className={`text-[15px] font-medium p-2.5 rounded-lg transition-colors flex items-center justify-between ${isActive('/chat') ? 'bg-[#f5fce8] text-[#72B626] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setIsMenuOpen(false)}
                style={{ textDecoration: 'none' }}
              >
                <span className="flex items-center gap-2">
                  <MessageCircle size={17} strokeWidth={2} />
                  Mensajes
                </span>
                {unreadCount > 0 && (
                  <span className="min-w-[18px] h-[18px] bg-[#72B626] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </>
          ) : userRole ? (
            <>
              <Link
                to="/dashboard"
                className={`text-[15px] font-medium p-2.5 rounded-lg transition-colors ${isActive('/dashboard') ? 'bg-[#f5fce8] text-[#72B626] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setIsMenuOpen(false)}
                style={{ textDecoration: 'none' }}
              >
                Mi Panel
              </Link>
              <Link
                to="/profile"
                className={`text-[15px] font-medium p-2.5 rounded-lg transition-colors ${isActive('/profile') ? 'bg-[#f5fce8] text-[#72B626] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setIsMenuOpen(false)}
                style={{ textDecoration: 'none' }}
              >
                Mi Perfil
              </Link>
              <Link
                to="/chat"
                className={`text-[15px] font-medium p-2.5 rounded-lg transition-colors flex items-center justify-between ${isActive('/chat') ? 'bg-[#f5fce8] text-[#72B626] font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setIsMenuOpen(false)}
                style={{ textDecoration: 'none' }}
              >
                <span className="flex items-center gap-2">
                  <MessageCircle size={17} strokeWidth={2} />
                  Mensajes
                </span>
                {unreadCount > 0 && (
                  <span className="min-w-[18px] h-[18px] bg-[#72B626] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </>
          ) : null}

          {userEmail ? (
            <div className="border-t border-gray-100 pt-3 mt-1 flex flex-col gap-2">
              <div className="flex items-center gap-2 px-2.5 py-2">
                <User size={16} className="text-gray-400" />
                <span className="text-[13px] text-gray-500 truncate">{userEmail}</span>
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 text-[14px] font-medium cursor-pointer"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleLogout();
                }}
              >
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-3 mt-1 flex flex-col gap-2">
              <Link
                to="/login"
                className="w-full flex items-center justify-center py-2.5 rounded-lg bg-[#72B626] text-white hover:bg-[#5e9620] text-[14px] font-medium cursor-pointer transition-colors"
                onClick={() => setIsMenuOpen(false)}
                style={{ textDecoration: 'none' }}
              >
                Iniciar Sesión
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
