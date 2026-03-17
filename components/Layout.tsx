

import React, { useState } from 'react';
import { User, UserRole, LicenseType, Language } from '../types';
import { 
  LayoutDashboard, 
  Save, 
  HardDrive, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  History,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';
import { useTranslation } from '../utils/translations';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  lang: Language;
  setLang: (l: Language) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentPage, onNavigate, lang, setLang }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isExpired = user.licenseType === LicenseType.EXPIRED;
  const t = useTranslation(lang);
  
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      {/* Floating Frosted Sidebar */}
      <aside className={`fixed top-4 left-4 bottom-4 ${isCollapsed ? 'w-20' : 'w-64'} bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300`}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between relative">
          <div className="flex items-center space-x-2 overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-blue-500 shrink-0" />
            {!isCollapsed && <h1 className="text-xl font-bold tracking-tight truncate">CloudGuard</h1>}
          </div>
          
          {/* Collapse Toggle Button - Positioned where the red dot was */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-8 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center border-2 border-slate-950 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/40 z-[60]"
            title={isCollapsed ? 'Expandir' : 'Recolher'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav className={`flex-1 ${isCollapsed ? 'p-2' : 'p-4'} space-y-2 overflow-y-auto custom-scrollbar`}>
          {(user.role === UserRole.ROOT || !user.allowedMenus || user.allowedMenus.includes('dashboard')) && (
            <NavItem 
              icon={<LayoutDashboard size={20} />} 
              label={t.layout.dashboard} 
              active={currentPage === 'dashboard'} 
              onClick={() => onNavigate('dashboard')} 
              isCollapsed={isCollapsed}
            />
          )}

          {(user.role === UserRole.ROOT || !user.allowedMenus || user.allowedMenus.includes('jobs')) && (
            <NavItem 
              icon={<Save size={20} />} 
              label={t.layout.jobs} 
              active={currentPage === 'jobs'} 
              onClick={() => onNavigate('jobs')} 
              isCollapsed={isCollapsed}
            />
          )}

          {(user.role === UserRole.ROOT || !user.allowedMenus || user.allowedMenus.includes('destinations')) && (
            <NavItem 
              icon={<HardDrive size={20} />} 
              label={t.layout.destinations} 
              active={currentPage === 'destinations'} 
              onClick={() => onNavigate('destinations')} 
              isCollapsed={isCollapsed}
            />
          )}

          {(user.role === UserRole.ROOT || !user.allowedMenus || user.allowedMenus.includes('history')) && (
            <NavItem 
              icon={<History size={20} />} 
              label={t.layout.history} 
              active={currentPage === 'history'} 
              onClick={() => onNavigate('history')} 
              isCollapsed={isCollapsed}
            />
          )}

          {(user.role === UserRole.ROOT || !user.allowedMenus || user.allowedMenus.includes('reports')) && (
            <NavItem 
              icon={<FileText size={20} />} 
              label={t.layout.reports} 
              active={currentPage === 'reports'} 
              onClick={() => onNavigate('reports')} 
              isCollapsed={isCollapsed}
            />
          )}

          {(user.role === UserRole.ROOT || !user.allowedMenus || user.allowedMenus.includes('settings')) && (
            <NavItem 
              icon={<Settings size={20} />} 
              label={t.layout.settings} 
              active={currentPage === 'settings' || currentPage === 'admin' || currentPage === 'clients' || currentPage === 'permissions'} 
              onClick={() => onNavigate('settings')} 
              isCollapsed={isCollapsed}
            />
          )}
        </nav>

        <div className={`p-4 border-t border-white/10 bg-slate-900/30 rounded-b-2xl ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
           {/* Language Toggle */}
           {!isCollapsed && (
             <div className="flex justify-center mb-4 space-x-2 p-1 bg-slate-800 rounded-lg">
               <button 
                  onClick={() => setLang('pt')}
                  className={`flex-1 text-xs py-1 px-2 rounded ${lang === 'pt' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
               >
                  PT-BR
               </button>
               <button 
                  onClick={() => setLang('en')}
                  className={`flex-1 text-xs py-1 px-2 rounded ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
               >
                  EN
               </button>
             </div>
           )}

          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-4' : 'justify-between'} mb-4 w-full`}>
            {!isCollapsed ? (
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user.username}</p>
                <p className={`text-xs truncate ${isExpired ? 'text-red-400' : 'text-green-400'}`}>
                  {user.role === UserRole.ROOT ? t.layout.unrestricted : user.licenseType}
                </p>
              </div>
            ) : (
                <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500' : 'bg-green-500'}`} />
            )}
            <button onClick={onLogout} className="text-slate-400 hover:text-white shrink-0" title={t.layout.logout}>
              <LogOut size={18} />
            </button>
          </div>
          
          {user.licenseType === LicenseType.TRIAL && user.role !== UserRole.ROOT && !isCollapsed && (
            <div className="text-xs text-center p-2 bg-indigo-900/50 rounded border border-indigo-800">
              {t.layout.trialMode}<br/>
              {(15 - Math.floor((Date.now() - user.createdAt)/(1000*60*60*24)))} {t.layout.daysLeft}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content - adjusted margin for floating sidebar */}
      <main className={`flex-1 ${isCollapsed ? 'ml-28' : 'ml-72'} p-8 min-h-screen transition-all duration-300`}>
        <div className="max-w-screen-2xl mx-auto animate-fade-in">
           {children}
        </div>
      </main>
    </div>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
  isCollapsed?: boolean;
}

const NavItem = ({ icon, label, active, onClick, className = '', isCollapsed = false }: NavItemProps) => (
  <button
    onClick={onClick}
    title={isCollapsed ? label : ''}
    className={`w-full flex ${isCollapsed ? 'flex-col items-center justify-center p-2 space-y-1.5' : 'flex-row items-center space-x-3 px-4 py-3'} rounded-lg transition-all duration-200 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 translate-x-1' 
        : 'text-slate-400 hover:bg-white/5 hover:text-white'
    } ${className}`}
  >
    <div className="shrink-0">{icon}</div>
    {isCollapsed ? (
       <span className="text-[10px] font-bold uppercase tracking-wider max-w-[64px] truncate" style={{ lineHeight: 1 }}>
         {label.split(' ')[0]} {/* Grab just first word to stay compact */}
       </span>
    ) : (
       <span className="font-medium truncate">{label}</span>
    )}
  </button>
);

export default Layout;
