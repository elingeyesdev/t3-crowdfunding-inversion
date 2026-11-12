import { 
  Info, 
  Heart, 
  Wallet 
} from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function ProfileTabs({ activeTab, setActiveTab }: Props) {
  const tabs = [
    { id: 'donations', label: 'Donaciones', icon: Heart },
    { id: 'info', label: 'Información', icon: Info },
    { id: 'capital', label: 'Capital / Fondos', icon: Wallet },
  ];

  return (
    <div className="bg-white border-t border-gray-100">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap px-4 sm:px-6 py-3 sm:py-4 text-[12px] sm:text-[14px] font-black transition-all duration-300 border-none bg-transparent cursor-pointer relative flex items-center gap-2 group
                ${isActive 
                  ? 'text-[#72B626]' 
                  : 'text-slate-400 hover:text-slate-900'
                }
              `}
            >
              <Icon size={18} strokeWidth={isActive ? 3 : 2} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className="uppercase tracking-widest">{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#72B626] rounded-t-full shadow-[0_-2px_8px_rgba(46,125,50,0.3)] animate-in fade-in slide-in-from-bottom-1 duration-500"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
