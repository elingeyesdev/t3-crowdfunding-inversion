import React, { useState } from 'react';
import { logout } from '../../api/auth.api';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  LogOut, 
  User, 
  Rocket,
  Menu,
  UserCheck,
  FileCheck,
  Shield,
  Receipt
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const role = localStorage.getItem('adminAccessLevel');
  const userEmail = localStorage.getItem('userEmail');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    try { await logout(); } catch { /* La sesión local se limpia aunque el servidor no responda. */ }
    navigate('/login');
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) => `
    flex items-center gap-3 px-3.5 py-2.5 text-[14px] font-medium transition-all duration-150 rounded-lg no-underline
    ${isActive 
      ? 'bg-white text-[#4a7f1a] font-semibold shadow-sm' 
      : 'text-white hover:bg-white/10'
    }
  `;

  return (
    <div className="flex min-h-screen bg-[#f9fafb] text-gray-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Sidebar */}
      <aside 
        className={`bg-[#72B626] flex flex-col transition-all duration-200 sticky top-0 h-screen shrink-0 z-50 ${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden md:w-16 md:px-2'
        }`}
      >
        {/* Sidebar Header / Logo */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-[#5e9620] bg-[#4a7f1a] overflow-hidden">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <img src="/logo.jpeg" alt="Logo" className="w-8 h-8 rounded-md object-cover" />
              <span className="text-white text-base font-bold tracking-tight whitespace-nowrap">
                Unifundme <span className="text-green-200 font-normal text-xs">Admin</span>
              </span>
            </div>
          ) : (
            <img src="/logo.jpeg" alt="Logo" className="w-8 h-8 rounded-md object-cover mx-auto" />
          )}
        </div>

        {/* Sidebar Nav */}
        <nav className="flex flex-col gap-1.5 p-3 flex-1 overflow-y-auto">
          {sidebarOpen && (
            <div className="text-[10px] font-bold text-green-100 uppercase tracking-wider px-3 mt-3 mb-1">
              Principal
            </div>
          )}
          <NavLink to="/admin" className={navItemClass} end style={{ textDecoration: 'none' }}>
            <LayoutDashboard size={18} />
            {sidebarOpen && <span>Estadísticas</span>}
          </NavLink>
          
          {sidebarOpen && (
            <div className="text-[10px] font-bold text-green-100 uppercase tracking-wider px-3 mt-3 mb-1">
              Gestión
            </div>
          )}
          <NavLink to="/admin/users" className={navItemClass} style={{ textDecoration: 'none' }}>
            <Users size={18} />
            {sidebarOpen && <span>Gestión de Usuarios</span>}
          </NavLink>
          <NavLink to="/admin/campaigns" className={navItemClass} end style={{ textDecoration: 'none' }}>
            <Rocket size={18} />
            {sidebarOpen && <span>Gestión de Campañas</span>}
          </NavLink>
          <NavLink to="/admin/kyc" className={navItemClass} style={{ textDecoration: 'none' }}>
            <UserCheck size={18} />
            {sidebarOpen && <span>Verificaciones KYC</span>}
          </NavLink>
          
          {sidebarOpen && (
            <div className="text-[10px] font-bold text-green-100 uppercase tracking-wider px-3 mt-3 mb-1">
              Auditoría
            </div>
          )}
          <NavLink to="/admin/campaigns/review" className={navItemClass} style={{ textDecoration: 'none' }}>
             <FileCheck size={18} />
             {sidebarOpen && <span>Revisión de Campañas</span>}
          </NavLink>
          <NavLink to="/admin/expenses" className={navItemClass} style={{ textDecoration: 'none' }}>
             <Receipt size={18} />
             {sidebarOpen && <span>Auditoría de Gastos</span>}
          </NavLink>

          {role === 'super_admin' && (
            <>
              {sidebarOpen && (
                <div className="text-[10px] font-bold text-green-100 uppercase tracking-wider px-3 mt-3 mb-1">
                  Sistema
                </div>
              )}
              <NavLink to="/superadmin" className={navItemClass} style={{ textDecoration: 'none' }}>
                <Shield size={18} />
                {sidebarOpen && <span>Gestión de Admins</span>}
              </NavLink>
            </>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#5e9620] bg-[#4a7f1a]">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-green-100 hover:text-white hover:bg-red-600 text-[14px] font-medium transition-all border-none bg-transparent cursor-pointer ${
              !sidebarOpen && 'justify-center'
            }`}
            title="Cerrar Sesión"
          >
            <LogOut size={18} />
            {sidebarOpen && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f9fafb]">
        {/* Header */}
        <header className="h-14 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 border-none bg-transparent cursor-pointer"
            >
              <Menu size={20} />
            </button>
          </div>
          
          <NavLink to="/profile" className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" style={{ textDecoration: 'none', color: 'inherit' }}>
             <div className="flex flex-col items-end">
                <span className="text-[13px] font-semibold text-gray-800 leading-none">{userEmail}</span>
                <span className="text-[10px] font-medium text-gray-500 mt-1">
                   {role === 'super_admin' ? 'Super Administrador' : 'Administrador'}
                </span>
             </div>
             <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600">
                <User size={18} />
             </div>
          </NavLink>
        </header>

        {/* Page content */}
        <main className="p-6 md:p-8 flex-1 bg-[#f9fafb]">
           {children}
        </main>
      </div>
    </div>
  );
}
