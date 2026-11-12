import { useState } from 'react';
import { X, Send, Image, Video, FileText, Loader2 } from 'lucide-react';
import { createCampaignUpdate } from '../api/campaign.api';

interface Props {
  campaignId: string;
  campaignTitle: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PublishUpdateModal({ campaignId, campaignTitle, open, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachmentType, setAttachmentType] = useState<'text' | 'image' | 'video'>('text');
  const [attachmentValue, setAttachmentValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleTabChange = (type: 'text' | 'image' | 'video') => {
    setAttachmentType(type);
    setAttachmentValue('');
    setSelectedFile(null);
    setFilePreview(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.length < 3) {
      setError('El título debe tener al menos 3 caracteres.');
      return;
    }
    if (!content.trim() || content.length < 10) {
      setError('El contenido debe tener al menos 10 caracteres.');
      return;
    }
    if (attachmentType !== 'text' && !selectedFile) {
      setError(`Debes seleccionar un archivo de ${attachmentType === 'image' ? 'imagen' : 'video'} para continuar.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const attachments: any[] = [];
    if (attachmentType === 'text' && attachmentValue.trim()) {
      attachments.push({ type: 'text', text: attachmentValue.trim() });
    }

    try {
      await createCampaignUpdate(
        campaignId,
        {
          title: title.trim(),
          content: content.trim(),
          isPublic: true,
          attachments,
        },
        attachmentType !== 'text' && selectedFile ? selectedFile : undefined
      );

      setSuccessMsg('Novedad publicada exitosamente.');
      setTitle('');
      setContent('');
      setAttachmentValue('');
      setSelectedFile(null);
      setFilePreview(null);
      
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 
        'Ocurrió un error al intentar publicar la novedad.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-250"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-250"
        style={{ border: '1px solid #e2e8f0' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Publicar Novedad</h3>
            <p className="text-xs font-semibold text-[#72B626] line-clamp-1">{campaignTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl text-[12px] font-bold text-red-600">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-[#f0f9e0] border border-gray-100 rounded-2xl text-[12px] font-bold text-[#4a7f1a]">
              {successMsg}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Título
            </label>
            <input
              type="text"
              required
              disabled={loading}
              placeholder="Ej. ¡Llegamos al 50% de nuestra meta!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#72B626]/20 focus:border-[#72B626] transition-all"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Contenido de la Novedad
            </label>
            <textarea
              required
              disabled={loading}
              rows={4}
              placeholder="Describe la actualización o avance reciente de tu proyecto..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#72B626]/20 focus:border-[#72B626] transition-all resize-none"
            />
          </div>

          {/* Attachment Selector */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Agregar Adjunto (Opcional)
            </label>
            <div className="flex flex-col sm:flex-row bg-slate-100 p-1.5 rounded-2xl gap-1 mb-3">
              <button
                type="button"
                onClick={() => handleTabChange('text')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition-all ${
                  attachmentType === 'text' ? 'bg-white text-[#4a7f1a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <FileText size={14} /> Texto Extra
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('image')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition-all ${
                  attachmentType === 'image' ? 'bg-white text-[#4a7f1a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Image size={14} /> Imagen (Local)
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('video')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-bold transition-all ${
                  attachmentType === 'video' ? 'bg-white text-[#4a7f1a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Video size={14} /> Video (Local)
              </button>
            </div>

            {attachmentType === 'text' ? (
              <input
                type="text"
                disabled={loading}
                placeholder="Texto descriptivo adicional o pie de foto..."
                value={attachmentValue}
                onChange={(e) => setAttachmentValue(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#72B626]/20 focus:border-[#72B626] transition-all"
              />
            ) : (
              <div 
                className={`relative h-[160px] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden cursor-pointer ${
                  filePreview ? 'border-[#72B626] bg-[#f0f9e0]/10' : 'border-slate-200 hover:border-[#d4f0a0] hover:bg-slate-50/50'
                }`}
                onClick={() => document.getElementById('update-file-upload')?.click()}
              >
                {filePreview ? (
                  attachmentType === 'image' ? (
                    <img src={filePreview} className="w-full h-full object-cover" alt="Preview" />
                  ) : (
                    <video src={filePreview} className="w-full h-full object-cover" muted playsInline />
                  )
                ) : (
                  <div className="flex flex-col items-center text-slate-400 px-4 text-center">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-2 border border-slate-100">
                      {attachmentType === 'image' ? <Image size={18} className="text-slate-400" /> : <Video size={18} className="text-slate-400" />}
                    </div>
                    <p className="text-[12px] font-bold text-slate-600">
                      Seleccionar {attachmentType === 'image' ? 'imagen' : 'video'} local
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Soporta JPG, PNG, WEBP, MP4, WEBM
                    </p>
                  </div>
                )}
                <input 
                  id="update-file-upload" 
                  type="file" 
                  accept={attachmentType === 'image' ? 'image/*' : 'video/*'} 
                  className="hidden" 
                  onChange={handleFileChange} 
                />
                {filePreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-900/60 hover:bg-slate-900/80 rounded-lg text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4 border-t border-slate-100 pt-5 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-[13px] transition-all hover:bg-slate-50 active:scale-95 text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#72B626] hover:bg-[#4a7f1a] text-white font-bold text-[13px] transition-all active:scale-95 shadow-lg shadow-[#f0f9e0]/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Publicando...
                </>
              ) : (
                <>
                  <Send size={15} /> Publicar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
