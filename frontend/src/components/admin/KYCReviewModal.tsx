import { useState } from 'react';
import { X, Check, Eye } from 'lucide-react';

interface KYCReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  kycData: any;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}

export function KYCReviewModal({ isOpen, onClose, kycData, onApprove, onReject }: KYCReviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!isOpen || !kycData) return null;

  const handleApprove = async () => {
    if (!window.confirm("¿Estás seguro de aprobar este KYC? Esta acción no se puede deshacer.")) {
      return;
    }
    try {
      setLoading(true);
      await onApprove(kycData.id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!showRejectForm) {
      setShowRejectForm(true);
      return;
    }
    if (!rejectReason.trim()) return;

    try {
      setLoading(true);
      await onReject(kycData.id, rejectReason);
      setRejectReason('');
      setShowRejectForm(false);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  let docs = [];
  try {
    if (typeof kycData.verification_documents === 'string') {
      docs = JSON.parse(kycData.verification_documents);
    } else {
      docs = kycData.verification_documents || [];
    }
  } catch (e) {}

  const idDoc = docs.find((d: any) => d.type === 'idDocument');
  const faceDoc = docs.find((d: any) => d.type === 'faceValidation');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900">Revisión KYC</h3>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Emprendedor: {kycData.first_name} {kycData.last_name} ({kycData.email})
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto space-y-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="font-bold text-gray-800 mb-3">Documento de Identidad</h4>
              {idDoc ? (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                   {idDoc.url.toLowerCase().endsWith('.pdf') ? (
                     <a href={idDoc.url} target="_blank" rel="noreferrer" className="flex flex-col items-center text-blue-600 hover:underline">
                        <Eye size={32} className="mb-2" />
                        Ver PDF
                     </a>
                   ) : (
                     <img 
                       src={idDoc.url} 
                       alt="ID Document" 
                       className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                       onClick={() => setPreviewImage(idDoc.url)}
                     />
                   )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No disponible</p>
              )}
            </div>
            
            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="font-bold text-gray-800 mb-3">Validación Facial</h4>
              {faceDoc ? (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                   {faceDoc.url.toLowerCase().match(/\.(mp4|webm|ogg)$/) ? (
                     <video src={faceDoc.url} controls className="w-full h-full object-contain" />
                   ) : (
                     <img 
                       src={faceDoc.url} 
                       alt="Face Validation" 
                       className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                       onClick={() => setPreviewImage(faceDoc.url)}
                     />
                   )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No disponible</p>
              )}
            </div>
          </div>

          {showRejectForm && (
            <div className="mt-6 border-t border-gray-200 pt-6 animate-in slide-in-from-top-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Motivo del Rechazo
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all resize-none"
                rows={3}
                placeholder="Ej: Documento borroso, validación facial no coincide..."
              />
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
          {showRejectForm ? (
            <>
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason('');
                }}
                disabled={loading}
                className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectReason.trim()}
                className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Confirmar Rechazo
              </button>
            </>
          ) : (
            <button
              onClick={handleReject}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl flex items-center justify-center gap-2"
            >
              <X size={16} /> Rechazar
            </button>
          )}
          <button
            onClick={handleApprove}
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold text-white bg-[#72B626] hover:bg-[#1c2b1e] rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-[#72B626]/20"
          >
            <Check size={16} /> Aprobar KYC
          </button>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewImage(null)}>
          <button 
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
            onClick={() => setPreviewImage(null)}
          >
            <X size={32} />
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain cursor-zoom-out" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
