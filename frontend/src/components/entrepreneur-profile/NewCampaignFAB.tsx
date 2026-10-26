import { Plus } from 'lucide-react';

type ModalType = 'profile' | 'personal' | 'company' | 'address' | 'banking' | 'avatar' | 'new-campaign' | null;

interface Props {
  openModal: (type: ModalType) => void;
}

export function NewCampaignFAB({ openModal, disabled }: Props & { disabled?: boolean }) {
  return (
    <div className="fixed bottom-10 right-10 group z-50">
       {/* Tooltip hint */}
       <div className="absolute right-[calc(100%+16px)] top-1/2 -translate-y-1/2 bg-[#1c2b1e] text-white px-4 py-2 rounded-xl text-[12px] font-black uppercase tracking-widest pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 whitespace-nowrap shadow-xl">
          {disabled ? 'Requiere Verificación KYC' : 'Lanzar Campaña'}
          <div className="absolute top-1/2 -translate-y-1/2 left-full w-2 h-2 bg-[#1c2b1e] rotate-45 -ml-1"></div>
       </div>

      <button
        onClick={() => {
          if (!disabled) openModal('new-campaign');
        }}
        disabled={disabled}
        className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-[0_8px_30px_rgba(46,125,50,0.4)] hover:shadow-[0_12px_45px_rgba(46,125,50,0.6)] transition-all duration-500 z-40 border-[3px] border-white/20 active:scale-90 group/btn relative overflow-hidden ${
          disabled 
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed hover:bg-gray-500 hover:shadow-none' 
            : 'bg-[#72B626] hover:bg-[#1c2b1e] text-white cursor-pointer'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
        <Plus size={32} strokeWidth={3} className="group-hover/btn:rotate-90 transition-transform duration-500" />
      </button>

      {/* Pulsing ring */}
      <div className="absolute inset-0 rounded-[24px] bg-[#72B626] animate-ping opacity-20 pointer-events-none scale-110 group-hover:animate-none"></div>
    </div>
  );
}
