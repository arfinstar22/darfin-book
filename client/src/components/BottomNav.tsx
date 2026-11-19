import React from 'react';
import { Home, Compass, Bookmark, User } from 'lucide-react';

export type NavTab = 'home' | 'explore' | 'shelf' | 'account';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  savedCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  savedCount = 0,
}) => {
  const tabs = [
    { id: 'home' as NavTab, label: 'Beranda', icon: Home },
    { id: 'explore' as NavTab, label: 'Jelajahi', icon: Compass },
    { id: 'shelf' as NavTab, label: 'Rak Saya', icon: Bookmark, badge: savedCount },
    { id: 'account' as NavTab, label: 'Akun', icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E8E5DF] dark:border-slate-800 bg-[#FDFBF7]/95 dark:bg-[#080E1E]/95 backdrop-blur-md pb-safe transition-colors duration-200"
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-xs font-medium transition touch-manipulation cursor-pointer ${
                isActive
                  ? 'text-[#0D9488] dark:text-teal-400 font-bold'
                  : 'text-[#6B7280] dark:text-slate-400 hover:text-[#1A1A1A] dark:hover:text-slate-100'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span>{tab.label}</span>

              {Boolean(tab.badge && tab.badge > 0) && (
                <span className="absolute top-1 right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#0D9488] dark:bg-teal-500 px-1 text-[10px] font-bold text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
