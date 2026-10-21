import { useState } from 'react';
import { addCapital } from '../api/investor.api';
import { 
  X, 
  TrendingUp, 
  DollarSign, 
  StickyNote, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ArrowUpCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAvailable: number | null;
  currentMax: number | null;
}

export function AddCapitalModal({ isOpen, onClose, onSuccess, currentAvailable, currentMax }: Props) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ newMax: number; availableCapital: number } | null>(null);

  const presetAmounts = [5000, 10000, 25000, 50000];

  const formatCurrency = (val: number) => {
    const formatted = new Intl.NumberFormat('es-BO', {
      maximumFractionDigits: 0,
    }).format(val);
    return `Bs. ${formatted}`;
  };

  const parsedAmount = Number(amount) || 0;
  const previewNewMax = (currentMax || 0) + parsedAmount;
  const previewAvailable = (currentAvailable || 0) + parsedAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount < 100) {
      setError('El monto mínimo es Bs. 100');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const result = await addCapital(parsedAmount, notes || undefined);
      setSuccess(result);
      // Refrescar dashboard tras 2 segundos
      setTimeout(() => {
        setSuccess(null);
        setAmount('');
        setNotes('');
        onSuccess();
        onClose();
      }, 2200);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al procesar la solicitud.';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setAmount('');
    setNotes('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[28px] w-full max-w-[480px] max-h-[90vh] flex flex-col shadow-2xl shadow-[#1c2b1e]/20/10 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1c2b1e] to-[#72B626] p-6 pb-8 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)',
          }} />
          <button
            onClick={handleClose}
            disabled={loading}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all border-none cursor-pointer disabled:opacity-50"
          >
            <X size={16} strokeWidth={3} />
          </button>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <ArrowUpCircle size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-white font-black text-[18px] tracking-tight leading-none mb-1">
                Aumentar Capital
              </h2>
              <p className="text-white/60 text-[12px] font-bold">
                Inyecta fondos a tu cuenta de donador
              </p>
            </div>
          </div>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-10 text-center animate-in zoom-in-95 fade-in duration-300 overflow-y-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f0f9e0] flex items-center justify-center">
              <CheckCircle2 size={32} className="text-[#72B626]" strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-2">
              ¡Capital Aumentado!
            </h3>
            <p className="text-[14px] text-slate-500 font-medium mb-4">
              Tu nuevo capital disponible es
            </p>
            <p className="text-3xl font-black text-[#72B626] tracking-tighter">
              {formatCurrency(success.availableCapital)}
            </p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
            {/* Current Balance Display */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 flex items-center justify-between">
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Capital actual
              </div>
              <div className="text-[18px] font-black text-[#1c2b1e] tracking-tight">
                {currentAvailable !== null ? formatCurrency(currentAvailable) : 'N/D'}
              </div>
            </div>

            {/* Amount Input */}
            <label className="block mb-2">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <DollarSign size={12} strokeWidth={3} />
                Monto a agregar
              </span>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-[15px]">Bs.</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setError(null); }}
                  placeholder="10.000"
                  min={100}
                  step={100}
                  required
                  disabled={loading}
                  className="w-full pl-14 pr-4 py-3.5 rounded-xl border-2 border-slate-200 focus:border-[#72B626] focus:ring-2 focus:ring-[#f0f9e0] text-[18px] font-black text-[#1c2b1e] tracking-tight transition-all outline-none disabled:opacity-50 bg-white"
                  style={{ appearance: 'textfield' }}
                />
              </div>
            </label>

            {/* Quick Amounts */}
            <div className="flex gap-2 mb-6 mt-3">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setAmount(String(preset)); setError(null); }}
                  disabled={loading}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-black tracking-tight transition-all border-2 cursor-pointer disabled:opacity-50 ${
                    parsedAmount === preset
                      ? 'bg-[#72B626] text-white border-[#72B626]'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-[#72B626] hover:text-[#72B626]'
                  }`}
                >
                  {formatCurrency(preset)}
                </button>
              ))}
            </div>

            {/* Notes */}
            <label className="block mb-6">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <StickyNote size={12} strokeWidth={3} />
                Notas (opcional)
              </span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Recarga para Q2 2026"
                maxLength={500}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#72B626] focus:ring-2 focus:ring-[#f0f9e0] text-[14px] font-medium text-[#1c2b1e] transition-all outline-none disabled:opacity-50 bg-white"
              />
            </label>

            {/* Preview */}
            {parsedAmount >= 100 && (
              <div className="bg-[#f0f9e0] rounded-2xl p-4 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-[#72B626]" strokeWidth={3} />
                  <span className="text-[11px] font-black text-[#72B626] uppercase tracking-widest">
                    Previsualización
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-bold text-[#72B626]/60 uppercase tracking-widest mb-1">
                      Nuevo Límite
                    </div>
                    <div className="text-[16px] font-black text-[#1c2b1e] tracking-tight">
                      {formatCurrency(previewNewMax)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#72B626]/60 uppercase tracking-widest mb-1">
                      Nuevo Disponible
                    </div>
                    <div className="text-[16px] font-black text-[#72B626] tracking-tight">
                      {formatCurrency(previewAvailable)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-[13px] font-bold rounded-xl px-4 py-3 mb-4 flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle size={16} strokeWidth={2.5} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || parsedAmount < 100}
              className="w-full py-4 rounded-2xl bg-[#72B626] hover:bg-[#1c2b1e] text-white font-black text-[15px] tracking-tight transition-all shadow-lg shadow-[#72B626]/20/20 border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" strokeWidth={3} />
                  Procesando...
                </>
              ) : (
                <>
                  <ArrowUpCircle size={18} strokeWidth={2.5} />
                  Confirmar +{parsedAmount >= 100 ? formatCurrency(parsedAmount) : 'Bs. 0'}
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
