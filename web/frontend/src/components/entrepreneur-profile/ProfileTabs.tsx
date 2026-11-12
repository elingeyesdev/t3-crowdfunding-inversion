import { 
  Info, 
  Briefcase, 
  CreditCard,
  Wallet 
} from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function ProfileTabs({ activeTab, setActiveTab }: Props) {
  const tabs = [
    { id: 'campaigns', label: 'Campañas', icon: Briefcase },
    { id: 'info', label: 'Información', icon: Info },
    { id: 'finance', label: 'Finanzas', icon: Wallet },
    { id: 'banking', label: 'Datos Bancarios', icon: CreditCard },
  ];

  return (
    <div className="bg-white lg:border-t lg:border-gray-100">
      <div className="max-w-[1100px] mx-auto px-2 sm:px-6 lg:px-4 flex gap-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap px-3 sm:px-4 lg:px-6 py-3 lg:py-4 text-[12px] sm:text-[13px] lg:text-[14px] font-bold lg:font-black transition-all duration-300 border-none bg-transparent cursor-pointer relative flex items-center gap-1.5 sm:gap-2 group
                ${isActive 
                  ? 'text-[#72B626]' 
                  : 'text-slate-400 hover:text-slate-900'
                }
              `}
            >
              <Icon strokeWidth={isActive ? 2.7 : 2} className={`w-4 h-4 lg:w-[18px] lg:h-[18px] transition-transform duration-300 ${isActive ? 'scale-105 lg:scale-110' : 'group-hover:scale-105 lg:group-hover:scale-110'}`} />
              <span className="lg:uppercase lg:tracking-widest">{tab.label}</span>

              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 lg:left-0 lg:right-0 h-0.5 lg:h-1 bg-[#72B626] rounded-t-full animate-in fade-in slide-in-from-bottom-1 duration-500 lg:shadow-[0_-4px_12px_rgba(114,182,38,0.3)]"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
