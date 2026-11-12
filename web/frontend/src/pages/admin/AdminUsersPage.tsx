import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { getAllUsers, softDeleteUser } from '../../api/admin.api';
import type { SystemUser } from '../../types/admin.types';
import { 
  Users, 
  Search, 
  Trash2, 
  Mail, 
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

export function AdminUsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialog state
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    userId: string;
    userEmail: string;
  } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getAllUsers();
      // Sort users by registration date descending if possible
      const sorted = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUsers(sorted);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, email: string) => {
    setDialog({
      isOpen: true,
      userId: id,
      userEmail: email
    });
  };

  const handleConfirmDelete = async () => {
    if (!dialog) return;
    const { userId } = dialog;
    setDialog(null);
    setActionLoading(userId);
    try {
      await softDeleteUser(userId);
      // Reload users to see updated status
      await loadUsers();
    } catch (error) {
      console.error('Error disabling user:', error);
      alert('Ocurrió un error al suspender al usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Users className="text-[#72B626]" size={26} />
              Gestión de Usuarios
            </h1>
            <p className="text-gray-500 text-[14px]">
              Visualiza y gestiona los accesos de los usuarios registrados en el sistema.
            </p>
          </div>
          <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
            <Users size={16} className="text-[#72B626]" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Usuarios:</span>
            <span className="text-sm font-bold text-gray-800">{users.length}</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar usuario por correo electrónico..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-[#72B626] focus:ring-3 focus:ring-[#72B626]/10 transition-all font-medium text-[13px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={loadUsers}
            className="px-4 py-2 bg-[#72B626] hover:bg-[#4a7f1a] text-white font-semibold rounded-lg transition-all active:scale-95 cursor-pointer border-none text-[13px]"
          >
            Actualizar Lista
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#72B626] rounded-full animate-spin"></div>
              <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Cargando usuarios...</p>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuario</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha de Registro</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/30 transition-colors group">
                      {/* User Email Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#f5fce8] group-hover:text-[#72B626] transition-all">
                            <Mail size={16} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-semibold text-[14px] group-hover:text-[#72B626] transition-colors">
                              {user.email}
                            </span>
                            <span className="text-[10px] text-gray-400">ID: {user.id.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* Created At Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600 font-medium text-[13px]">
                          <Calendar size={14} className="text-gray-400" />
                          {new Date(user.created_at).toLocaleDateString('es-ES', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-700 bg-green-50 border border-green-100">
                            <CheckCircle size={12} /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-red-700 bg-red-50 border border-red-100">
                            <XCircle size={12} /> Suspendido
                          </span>
                        )}
                      </td>

                      {/* Action Column */}
                      <td className="px-6 py-4 text-right">
                        {user.is_active ? (
                          <button 
                            onClick={() => handleDeleteClick(user.id, user.email)}
                            disabled={actionLoading === user.id}
                            className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg transition-all active:scale-95 shadow-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Suspender Cuenta"
                          >
                            <Trash2 size={14} />
                            <span className="text-[11px] font-bold uppercase tracking-wider hidden md:inline">Dar de Baja</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-gray-400 italic">Sin acciones</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
                <Users size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">Sin resultados</h3>
              <p className="text-gray-500 max-w-sm text-xs">
                No se encontraron usuarios que coincidan con la búsqueda "{searchTerm}".
              </p>
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        {dialog && dialog.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div 
              className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" 
              onClick={() => setDialog(null)} 
            />
            <div className="bg-white rounded-2xl w-full max-w-md p-6 relative z-10 shadow-xl border border-gray-200 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-3 text-red-600">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-gray-900">¿Suspender usuario?</h3>
              </div>
              
              <p className="text-gray-500 font-medium text-sm mb-5 leading-relaxed">
                Estás a punto de suspender la cuenta del usuario <span className="font-bold text-gray-900">{dialog.userEmail}</span>. 
                Esto desactivará su acceso a la plataforma de inmediato.
              </p>
              
              <div className="flex justify-end gap-2.5">
                <button
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs uppercase tracking-wider transition-all active:scale-95 border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs uppercase tracking-wider transition-all active:scale-95 border-none cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
