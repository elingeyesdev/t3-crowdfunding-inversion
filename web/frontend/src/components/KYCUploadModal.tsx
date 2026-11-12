import { useEffect, useRef, useState } from 'react';
import { submitKycDocuments } from '../api/entrepreneur.api';
import type { EntrepreneurProfile } from '../types/entrepreneur.types';
import { InfoHint } from './InfoHint';

interface KYCUploadModalProps {
  onClose: () => void;
  onSuccess: (profile: EntrepreneurProfile) => void;
}

export function KYCUploadModal({ onClose, onSuccess }: KYCUploadModalProps) {
  const [step, setStep] = useState(1);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [faceVideo, setFaceVideo] = useState<File | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const idInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setIsStartingCamera(true);
      setCameraError('');
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
      setCameraError('No se pudo acceder a la cámara. Verifica permisos del navegador.');
    } finally {
      setIsStartingCamera(false);
    }
  };

  useEffect(() => {
    if (step === 2 && !faceVideo) startCamera();
    return () => stopCamera();
  }, [step]);

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setFaceVideo(new File([blob], `kyc-selfie-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      setCapturedPreview(URL.createObjectURL(blob));
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  const handleSubmit = async () => {
    if (!idDocument || !faceVideo) return setError('Por favor adjunta ambos documentos requeridos.');
    try {
      setIsSubmitting(true);
      setError('');
      const updatedProfile = await submitKycDocuments(idDocument, faceVideo);
      onSuccess(updatedProfile);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error al enviar documentos KYC.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Verificación de Identidad (KYC)</h3>
            <p className="text-sm text-gray-500 mt-1">Paso {step} de 2: {step === 1 ? 'Documento de Identidad' : 'Validación Facial'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">✕</button>
        </div>
        <div className="p-6 overflow-y-auto">
          {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">{error}</div>}
          {step === 1 && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">Sube tu Documento Oficial <InfoHint text="Formato imagen o PDF, legible y vigente." /></label>
              <div onClick={() => idInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer ${idDocument ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                <p className="font-semibold break-words">{idDocument ? idDocument.name : 'Haz clic para seleccionar archivo'}</p>
                <input ref={idInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setIdDocument(e.target.files?.[0] || null)} />
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">Selfie con documento <InfoHint text="Toma la foto en vivo con tu cámara o sube un archivo." /></label>
              {!faceVideo ? (
                <div className="border-2 border-dashed rounded-xl p-4 bg-gray-50">
                  <div className="rounded-lg overflow-hidden bg-black mb-3 min-h-[220px] relative">
                    <video ref={videoRef} className="w-full h-full object-cover absolute inset-0" playsInline muted autoPlay onLoadedMetadata={() => { videoRef.current?.play().catch(() => {}); }} />
                    {!isCameraActive && <div className="absolute inset-0 flex items-center justify-center text-gray-200 bg-black/50 text-center p-4">Activa tu cámara para tomar la foto</div>}
                  </div>
                  {cameraError && <p className="text-sm text-red-600 font-medium mb-3">{cameraError}</p>}
                  <div className="flex gap-2 mb-3">
                    <button type="button" onClick={startCamera} disabled={isStartingCamera || isSubmitting} className="flex-1 px-4 py-2 text-[13px] md:text-sm font-bold text-white bg-blue-600 rounded-lg disabled:opacity-50">{isStartingCamera ? 'Iniciando...' : 'Activar cámara'}</button>
                    <button type="button" onClick={captureFromCamera} disabled={!isCameraActive || isSubmitting} className="flex-1 px-4 py-2 text-[13px] md:text-sm font-bold text-white bg-[#72B626] rounded-lg disabled:opacity-50">Tomar foto</button>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />

                  <div className="pt-3 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-500 mb-2">¿Sin cámara o problemas de permisos?</p>
                    <label className="inline-block px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      Subir foto desde archivo
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFaceVideo(file);
                            setCapturedPreview(URL.createObjectURL(file));
                            stopCamera();
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-green-400 bg-green-50 rounded-xl p-4 text-green-700">
                  {capturedPreview && <img src={capturedPreview} alt="Captura KYC" className="w-full max-h-64 object-cover rounded-lg mb-3" />}
                  <button type="button" onClick={() => { setFaceVideo(null); setCapturedPreview(null); startCamera(); }} className="w-full px-4 py-2 text-sm font-bold text-[#4a7f1a] bg-[#f0f9e0] rounded-lg">Tomar otra foto</button>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between pt-6 border-t border-gray-100 mt-6 shrink-0">
            <button type="button" onClick={() => (step > 1 ? setStep(step - 1) : onClose())} className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl" disabled={isSubmitting}>{step > 1 ? 'Atrás' : 'Cancelar'}</button>
            {step < 2 ? (
              <button type="button" onClick={() => setStep(2)} disabled={!idDocument} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl disabled:opacity-50">Siguiente</button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={!idDocument || !faceVideo || isSubmitting} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl disabled:opacity-50">{isSubmitting ? 'Enviando...' : 'Enviar a Revisión'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
