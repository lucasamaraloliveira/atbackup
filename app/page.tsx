"use client";

import React, { useState, useEffect, useRef } from 'react';
import { User, BackupJob, Destination, UserRole, LicenseType, Language } from '@/types';
import { AuthService, DataService } from '@/services/storageService';
import Layout from '@/components/Layout';
import Auth from '@/components/Auth';
import Dashboard from '@/components/Dashboard';
import Destinations from '@/components/Destinations';
import JobEditor from '@/components/JobEditor';
import AdminPanel from '@/components/AdminPanel';
import ClientManager from '@/components/ClientManager';
import HistoryView from '@/components/HistoryView';
import ReportsView from '@/components/ReportsView';
import { PermissionsPanel } from '@/components/PermissionsPanel';
import { useTranslation } from '@/utils/translations';
import { LucideIcon } from 'lucide-react'; // For types if needed

// Standard lucide-react icons
import { 
  Play as PlayIcon, 
  Edit as EditIcon, 
  Trash as TrashIcon, 
  AlertTriangle as AlertTriangleIcon, 
  CheckCircle as CheckCircleIcon, 
  ShieldAlert as ShieldAlertIcon, 
  X as XIcon, 
  LogOut as LogOutIcon, // Added this icon!
  Eye as EyeIcon, 
  EyeOff as EyeOffIcon, 
  Calendar as CalendarIcon,
  Loader2 as LoaderIcon,
  ArrowRight as ArrowRightIcon,
  ArrowDown as ArrowDownIcon,
  Clock as ClockIcon,
  Server as ServerIcon
} from 'lucide-react';

interface BackupResult {
  destination: string;
  status: 'SUCCESS' | 'ERROR' | 'SUCCESS (MOCK)';
  message?: string;
  fileCount?: number;
  integrity?: boolean;
  processedFiles?: string[];
}

function parseCronToText(cron: string, t: any) {
  if (!cron) return 'N/A';
  const parts = cron.split(' ');
  if (parts.length < 5) return cron;
  
  const minute = parts[0].padStart(2, '0');
  const hour = parts[1].padStart(2, '0');
  const time = `${hour}:${minute}`;

  if (parts[4] !== '*') {
    const days = parts[4].split(',').map(Number).map((d: number) => t.jobs.weekDaysShort[d]).join(', ');
    return t.jobs.cronDesc.weekly.replace('{days}', days).replace('{time}', time);
  } else if (parts[2] !== '*') {
    return t.jobs.cronDesc.monthly.replace('{day}', parts[2]).replace('{time}', time);
  } else {
    return t.jobs.cronDesc.daily.replace('{time}', time);
  }
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<string>('dashboard');
  const [lang, setLang] = useState<Language>('pt'); // Default to PT
  
  // Data State
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [editingJob, setEditingJob] = useState<BackupJob | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [licenseInput, setLicenseInput] = useState('');

  // Password Change State
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [showPassCurrent, setShowPassCurrent] = useState(false);
  const [showPassNew, setShowPassNew] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);

  // Expiry Modal State
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);

  // Parallel Backup State
  const [activeTasks, setActiveTasks] = useState<Record<string, any>>({});
  const [currentModalTaskId, setCurrentModalTaskId] = useState<string | null>(null);
  
  const [history, setHistory] = useState<any[]>([]);
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // Progress Modal View Mode
  const [showRealTime, setShowRealTime] = useState(false);

  // Transition States
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);

  const t = useTranslation(lang);

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      checkExpiryWarning(currentUser);
      loadData();
      
      // Initial page safety for sub-accounts
      if (currentUser.parentId && currentUser.allowedMenus && !currentUser.allowedMenus.includes('dashboard')) {
        setPage(currentUser.allowedMenus[0] || 'history');
      }

      // Delay expiry warning by 1 minute on reload
      setTimeout(() => {
        checkExpiryWarning(currentUser);
      }, 60000);
    }
  }, []);

  // Daemon schedule executor
  useEffect(() => {
    if (!user) return; // Only stop if no user is totally logged in
    
    const interval = setInterval(() => {
      // Actively check for license expiry during runtime
      const freshUser = AuthService.getCurrentUser();
      if (freshUser && freshUser.licenseType === LicenseType.EXPIRED && user.licenseType !== LicenseType.EXPIRED) {
         setUser(freshUser); // Instant block
         return;
      }
      
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentHour = now.getHours();
      const currentDayOfMonth = now.getDate();
      const currentMonth = now.getMonth() + 1;
      const currentDayOfWeek = now.getDay();
      
      // Always get fresh jobs list to avoid stale state in interval
      const currentJobs = DataService.getJobs();
      
      for (const job of currentJobs) {
        if (!job.scheduleCron || job.status === 'RUNNING') continue;
        
        // Skip if this job is already being handled in activeTasks
        if (Object.values(activeTasks).some(t => t.jobId === job.id && t.status === 'RUNNING')) continue;

        const parts = job.scheduleCron.split(' ');
        if (parts.length < 5) continue;
        
        // parts format: minute hour dayOfMonth month dayOfWeek
        if (parts[0] !== '*' && parseInt(parts[0]) !== currentMinute) continue;
        if (parts[1] !== '*' && parseInt(parts[1]) !== currentHour) continue;
        if (parts[2] !== '*' && parseInt(parts[2]) !== currentDayOfMonth) continue;
        if (parts[3] !== '*' && parseInt(parts[3]) !== currentMonth) continue;
        
        if (parts[4] !== '*') {
          const validDays = parts[4].split(',').map(Number);
          if (!validDays.includes(currentDayOfWeek)) continue;
        }
        
        // Check if recently run (within last 60 seconds) to avoid loops
        if (job.lastRun && (Date.now() - job.lastRun < 60000)) continue;
        
        runJob(job.id);
      }
    }, 15000); 
    
    return () => clearInterval(interval);
  }, [user, activeTasks]);

  const loadData = () => {
    setJobs(DataService.getJobs());
    setDestinations(DataService.getDestinations());
    setHistory(DataService.getHistory());
  };

  const checkExpiryWarning = (u: User) => {
      // Don't warn root
      if (u.role === UserRole.ROOT) return;

      const ONE_DAY = 24 * 60 * 60 * 1000;
      let days = 0;
      
      if (u.licenseType === LicenseType.TRIAL) {
          days = 15 - Math.floor((Date.now() - u.createdAt) / ONE_DAY);
      } else {
          const activation = u.licenseActivatedAt || u.createdAt;
          const duration = u.licenseDuration || 365;
          days = duration - Math.floor((Date.now() - activation) / ONE_DAY);
      }
      
      setDaysRemaining(days);

      const threshold = u.notificationThresholdDays || 15;
      
      if (days <= threshold && days >= 0) {
          if (!sessionStorage.getItem('expiry_warned')) {
              setShowExpiryModal(true);
              sessionStorage.setItem('expiry_warned', 'true');
          }
      }
  };

  const interruptBackup = async (taskId: string) => {
    try {
      await fetch(`/api/backup/stop/${taskId}`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to stop backup', e);
    }
    
    if (abortControllersRef.current[taskId]) {
        abortControllersRef.current[taskId].abort();
        delete abortControllersRef.current[taskId];
    }
  };

  const handleLogin = (u: User) => {
    setIsLoadingSetup(true);
    
    // Simulate initial sequence
    setTimeout(() => {
      setIsLoadingSetup(false);
      setShowPresentation(true);
      setUser(u);
      loadData();
      
      // Safety check for sub-accounts menu permissions
      if (u.parentId && u.allowedMenus && !u.allowedMenus.includes('dashboard')) {
          setPage(u.allowedMenus[0] || 'history');
      } else {
          setPage('dashboard');
      }

      // Hide presentation after 3 seconds
      setTimeout(() => {
        setShowPresentation(false);
      }, 3000);

      // Delay expiry warning by 1 minute after login
      setTimeout(() => {
        checkExpiryWarning(u);
      }, 60000);

    }, 1500);
  };

  const forceTrialExpiry = () => {
    if (!user) return;
    if (confirm("MODO DESENVOLVEDOR: O Trial será configurado para expirar em 1 minuto. Continuar?")) {
      const newDate = Date.now() - (15 * 24 * 60 * 60 * 1000) + (60 * 1000);
      AuthService.updateUserConfig(user.id, { createdAt: newDate });
      alert("Data adulterada com sucesso! Atualizando...");
      window.location.reload();
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    setUser(null);
    sessionStorage.removeItem('expiry_warned');
  };

  const saveJob = (job: BackupJob) => {
    DataService.saveJob(job);
    setJobs(DataService.getJobs());
    setIsEditing(false);
    setEditingJob(undefined);
  };

  const deleteJob = (id: string) => {
    if (confirm(t.jobs.confirmDelete)) {
      DataService.deleteJob(id);
      setJobs(DataService.getJobs());
    }
  };

  const pollTaskStatus = async (taskId: string, jobId: string) => {
    const maxRetries = 10;
    let retries = 0;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/backup/status/${taskId}`);
        if (!response.ok) {
           retries++;
           if (retries > maxRetries) clearInterval(interval);
           return;
        }
        const task = await response.json();

        if (task.status === 'SUCCESS' || task.status === 'ERROR') {
          clearInterval(interval);
          
          setActiveTasks(prev => {
            const current = { ...prev[taskId] };
            current.status = task.status;
            current.results = task.results || [];
            current.prepSteps = current.prepSteps.map((s: any) => ({ ...s, status: 'done' }));
            return { ...prev, [taskId]: current };
          });

          // Update Jobs list status
          setJobs(prev => prev.map(j => {
            if (j.id === jobId) return { ...j, status: task.status, lastRun: task.endTime || Date.now() };
            return j;
          }));

          // Save to local storage (DataService)
          const currentJobs = DataService.getJobs();
          const jIdx = currentJobs.findIndex(j => j.id === jobId);
          if (jIdx !== -1) {
            currentJobs[jIdx].status = task.status;
            currentJobs[jIdx].lastRun = task.endTime || Date.now();
            DataService.saveJob(currentJobs[jIdx]);
          }

          // Save to History
          const historyEntry = {
            id: Math.random().toString(36).substring(2, 9),
            jobId: jobId,
            jobName: activeTasks[taskId]?.jobName || 'Job',
            timestamp: Date.now(),
            status: task.status,
            fileCount: task.results?.reduce((acc: number, curr: any) => acc + (curr.fileCount || 0), 0) || 0,
            integrity: task.results?.every((r: any) => r.integrity) || false,
            details: task.status === 'SUCCESS' 
                ? task.results?.map((r: any) => `${r.destination}: OK`).join(', ') || 'Sucesso' 
                : task.error || 'Erro na migração'
          };
          DataService.saveHistoryEntry(historyEntry);
          setHistory(DataService.getHistory());
        } else {
           // During RUNNING, update live stats
           setActiveTasks(prev => {
              const current = { ...prev[taskId] };
              if (!current) return prev;
              
              const results = task.results || [];
              if (results.length === 0 && task.processedFiles?.length > 0) {
                 results.push({ 
                   destination: lang === 'pt' ? 'Sincronizando...' : 'Syncing...', 
                   status: 'SUCCESS (MOCK)', 
                   processedFiles: task.processedFiles 
                 });
              }
              
              current.results = results;
              current.processedFiles = task.processedFiles;
              return { ...prev, [taskId]: current };
           });
        }
      } catch (error) {
        console.error('Polling error:', error);
        retries++;
        if (retries > maxRetries) clearInterval(interval);
      }
    }, 1500);
  };

  const runJob = async (id: string) => {
    const freshJobs = DataService.getJobs();
    const job = freshJobs.find(j => j.id === id);
    if (!job) return;

    // Create a temporary task ID to show prep steps immediately
    const tempId = `temp-${Date.now()}`;
    const initialPrep = [
      { msg: lang === 'pt' ? 'Validando integridade da estrutura...' : 'Validating structure integrity...', status: 'active' },
      { msg: lang === 'pt' ? 'Analisando alterações incrementais...' : 'Scanning for incremental changes...', status: 'pending' },
      { msg: lang === 'pt' ? 'Autenticando e preparando destinos...' : 'Authenticating destinations...', status: 'pending' },
      { msg: lang === 'pt' ? 'Iniciando motor de transferência (Multi-thread)...' : 'Starting transfer engine...', status: 'pending' }
    ];

    setActiveTasks(prev => ({
      ...prev,
      [tempId]: {
        jobId: job.id,
        jobName: job.name,
        status: 'RUNNING',
        results: [],
        prepSteps: initialPrep,
        sourcePath: job.sourcePath,
        destinationIds: job.destinationIds
      }
    }));
    setCurrentModalTaskId(tempId);

    // Animate prep steps
    const animateNext = (stepIdx: number) => {
       setActiveTasks(prev => {
          if (!prev[tempId]) return prev;
          const next = { ...prev[tempId] };
          const steps = [...next.prepSteps];
          if (steps[stepIdx-1]) steps[stepIdx-1].status = 'done';
          if (steps[stepIdx]) steps[stepIdx].status = 'active';
          next.prepSteps = steps;
          return { ...prev, [tempId]: next };
       });
    };

    setTimeout(() => animateNext(1), 1000);
    setTimeout(() => animateNext(2), 2000);

    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'RUNNING' } : j));

    try {
      const freshDestinations = DataService.getDestinations();
      const jobDestinations = freshDestinations.filter(d => job.destinationIds.includes(d.id));
      
      const controller = new AbortController();
      abortControllersRef.current[tempId] = controller;

      const response = await fetch('/api/backup/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, destinations: jobDestinations }),
        signal: controller.signal
      });

      const data = await response.json();

      if (data.success && data.taskId) {
        // Migration from tempId to real taskId
        setActiveTasks(prev => {
          const newState = { ...prev };
          const taskData = { ...newState[tempId], taskId: data.taskId };
          // Step 4 active
          taskData.prepSteps[2].status = 'done';
          taskData.prepSteps[3].status = 'active';
          
          delete newState[tempId];
          newState[data.taskId] = taskData;
          return newState;
        });
        
        delete abortControllersRef.current[tempId];
        abortControllersRef.current[data.taskId] = controller;
        setCurrentModalTaskId(data.taskId);

        pollTaskStatus(data.taskId, id);
      } else {
        throw new Error(data.error || 'Falha ao iniciar processo');
      }
    } catch (error) {
       console.error('Backup Initiation Error:', error);
       setActiveTasks(prev => {
          const next = { ...prev[tempId] };
          if (!next) return prev;
          next.status = 'ERROR';
          next.prepSteps = next.prepSteps.map((s: any) => ({ ...s, status: 'done' }));
          next.results = [{ destination: 'Geral', status: 'ERROR', message: error instanceof Error ? error.message : 'Erro crítico' }];
          return { ...prev, [tempId]: next };
       });
    }
  };

  const redeemLicense = () => {
    if (user && AuthService.redeemKey(user.username, licenseInput)) {
      alert(t.settings.success);
      const updatedUser = AuthService.getCurrentUser();
      setUser(updatedUser);
      setLicenseInput('');
    } else {
      alert(t.settings.invalid);
    }
  };

  const handleChangePassword = () => {
      if (!user) return;
      if (passData.new !== passData.confirm) {
          alert(t.settings.passMismatch);
          return;
      }
      if (user.password && user.password !== passData.current) {
          alert(t.settings.invalid); // Reuse invalid message for wrong pass
          return;
      }

      AuthService.changePassword(user.id, passData.new);
      alert(t.settings.passChanged);
      setPassData({ current: '', new: '', confirm: '' });
  };

  const getExpiryDate = () => {
      if (!user) return '';
      const ONE_DAY = 24 * 60 * 60 * 1000;
      const start = (user.licenseType === LicenseType.PRO ? user.licenseActivatedAt : user.createdAt) || Date.now();
      const duration = user.licenseType === LicenseType.PRO ? (user.licenseDuration || 365) : 15;
      const expiry = new Date(start + (duration * ONE_DAY));
      return expiry.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US');
  };

  if (isLoadingSetup) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <LoaderIcon className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400 animate-pulse font-medium">{t.layout.loading}</p>
      </div>
    );
  }

  if (showPresentation) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="p-4 bg-blue-600/20 rounded-full mb-6 animate-bounce shadow-[0_0_30px_rgba(37,99,235,0.3)]">
          <CheckCircleIcon className="w-16 h-16 text-blue-500" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4 animate-in slide-in-from-bottom duration-700">{t.auth.title}</h1>
        <p className="text-xl text-slate-400 max-w-md animate-in fade-in duration-1000 delay-300">{t.layout.presentation}</p>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={handleLogin} lang={lang} setLang={setLang} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout} currentPage={page} onNavigate={setPage} lang={lang} setLang={setLang}>
      {/* Expiry Warning Modal */}
      {showExpiryModal && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-500">
              <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-md w-full p-8 shadow-[0_0_50px_rgba(239,68,68,0.15)] relative animate-modal-pop overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                  <button onClick={() => setShowExpiryModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                      <XIcon size={20} />
                  </button>
                  <div className="flex flex-col items-center text-center mb-4">
                      <ShieldAlertIcon size={48} className="text-red-500 mb-4" />
                      <h2 className="text-xl font-bold text-white mb-2">{t.settings.expiryWarning}</h2>
                      <p className="text-slate-300">
                          {t.settings.licenseExpiringIn} <span className="font-bold text-red-400">{daysRemaining} {t.admin.days}</span>.
                      </p>
                  </div>
                  <div className="bg-red-900/20 border border-red-900/50 p-4 rounded text-sm text-red-200 mb-6 text-center">
                      {t.settings.pleaseContact}
                  </div>
                  <button 
                    onClick={() => setShowExpiryModal(false)}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded transition-colors"
                  >
                      OK
                  </button>
              </div>
          </div>
      )}

      {/* Expiry BLOCKED Modal (Blue Screen) */}
      {user.licenseType === LicenseType.EXPIRED && user.role !== UserRole.ROOT && (
          <div className="fixed inset-0 bg-blue-950/90 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-4">
              <div className="absolute inset-0 bg-blue-600/10 pointer-events-none"></div>
              <div className="bg-slate-900 border border-blue-500/50 rounded-2xl max-w-lg w-full p-8 shadow-[0_0_100px_rgba(37,99,235,0.2)] relative text-center z-10">
                  <ShieldAlertIcon size={64} className="text-blue-500 mx-auto mb-6" />
                  <h2 className="text-3xl font-black text-white mb-4">Acesso Bloqueado</h2>
                  <p className="text-slate-300 text-lg mb-8">
                      O seu período de testes ou licença Expirou. O acesso aos dados e funções desta conta foi restrito.
                  </p>
                  
                  <div className="mt-4 pt-6 border-t border-slate-700/50">
                      <label className="block text-slate-100 font-medium mb-3 text-left">Renovar Instância</label>
                      <div className="flex space-x-2">
                          <input 
                              type="text" 
                              value={licenseInput}
                              onChange={(e) => setLicenseInput(e.target.value)}
                              placeholder={t.settings.enterKey}
                              className="flex-1 bg-slate-950 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                          />
                          <button 
                              onClick={redeemLicense}
                              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-lg transition-all shadow-lg shadow-blue-900/40"
                          >
                              {t.settings.activateBtn}
                          </button>
                      </div>
                      
                      <div className="mt-6 flex flex-col gap-4">
                        <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg text-sm text-slate-300 text-left">
                            <h4 className="font-bold text-slate-100 mb-1">Como Ativar?</h4>
                            Entre em contato com o suporte ou gestor (Administrador Root do sistema) informando o usuário <strong>{user.username}</strong> para adquirir uma chave de licenciamento válida.
                        </div>
                        <div className="flex justify-center">
                          <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-white flex items-center gap-2 hover:bg-slate-800 px-4 py-2 rounded-lg transition-all">
                              <LogOutIcon size={16}/> Sair da Conta
                          </button>
                        </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {page === 'dashboard' && <Dashboard jobs={jobs} destinations={destinations} lang={lang} />}
      
      {page === 'reports' && (
        <ReportsView 
          lang={lang} 
          jobs={jobs} 
          destinations={destinations} 
          history={history} 
          users={user.role === UserRole.ROOT ? AuthService.getAllUsers() : []}
        />
      )}
      
      
      
      
      {page === 'destinations' && (
        <Destinations 
          destinations={destinations}
          onAdd={(d) => { DataService.saveDestination(d); setDestinations(DataService.getDestinations()); }}
          onDelete={(id) => { DataService.deleteDestination(id); setDestinations(DataService.getDestinations()); }}
          lang={lang}
        />
      )}

      {(page === 'settings' || page === 'admin' || page === 'clients' || page === 'permissions') && (
         <div className="space-y-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">{t.layout.settings}</h2>
                    <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 overflow-x-auto">
                        <button 
                            onClick={() => setPage('settings')} 
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${page === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            {t.settings.title}
                        </button>
                        {user.role !== UserRole.ROOT && (
                            <button 
                                onClick={() => setPage('permissions')} 
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${page === 'permissions' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                {t.settings.permissionsTab}
                            </button>
                        )}
                        <button 
                            onClick={() => setPage('admin')} 
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${page === 'admin' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            {t.layout.licenseManager}
                        </button>
                        {user.role === UserRole.ROOT && (
                            <button 
                                onClick={() => setPage('clients')} 
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${page === 'clients' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                {t.layout.clients}
                            </button>
                        )}
                    </div>
                </div>

                {page === 'settings' ? (
                    <div className="bg-slate-800/80 backdrop-blur p-8 rounded-xl border border-slate-700/50 shadow-xl space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2"><ShieldAlertIcon size={24} className="text-blue-400"/> {t.settings.changePass}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">{t.settings.currentPass}</label>
                                <div className="relative">
                                    <input 
                                        type={showPassCurrent ? 'text' : 'password'} 
                                        value={passData.current}
                                        onChange={e => setPassData({...passData, current: e.target.value})}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 pr-10 focus:border-blue-500 outline-none"
                                    />
                                    <button type="button" onClick={() => setShowPassCurrent(!showPassCurrent)} className="absolute right-3 top-2.5 text-slate-500 hover:text-white">
                                        {showPassCurrent ? <EyeOffIcon size={18}/> : <EyeIcon size={18}/>}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">{t.settings.newPass}</label>
                                    <div className="relative">
                                        <input 
                                            type={showPassNew ? 'text' : 'password'} 
                                            value={passData.new}
                                            onChange={e => setPassData({...passData, new: e.target.value})}
                                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 pr-10 focus:border-blue-500 outline-none"
                                        />
                                        <button type="button" onClick={() => setShowPassNew(!showPassNew)} className="absolute right-3 top-2.5 text-slate-500 hover:text-white">
                                            {showPassNew ? <EyeOffIcon size={18}/> : <EyeIcon size={18}/>}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">{t.settings.confirmPass}</label>
                                    <div className="relative">
                                        <input 
                                            type={showPassConfirm ? 'text' : 'password'}
                                            value={passData.confirm}
                                            onChange={e => setPassData({...passData, confirm: e.target.value})}
                                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 pr-10 focus:border-blue-500 outline-none"
                                        />
                                        <button type="button" onClick={() => setShowPassConfirm(!showPassConfirm)} className="absolute right-3 top-2.5 text-slate-500 hover:text-white">
                                            {showPassConfirm ? <EyeOffIcon size={18}/> : <EyeIcon size={18}/>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button onClick={handleChangePassword} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded transition-all shadow-lg shadow-blue-900/40">
                                    {t.settings.changePass}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : page === 'admin' ? (
                    <div className="space-y-6">
                        <div className="bg-slate-800/80 backdrop-blur p-8 rounded-xl border border-slate-700/50 shadow-xl">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-100">
                                <ShieldAlertIcon size={24} className="text-amber-400"/>
                                {t.settings.licenseInfo}
                            </h2>
                            <div className="flex flex-col space-y-4">
                                <div className="flex items-center space-x-3">
                                    <div className={`px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm ${user.role === UserRole.ROOT ? 'bg-blue-900/50 text-blue-400 border border-blue-500/20' : (user.licenseType === LicenseType.PRO ? 'bg-green-900/50 text-green-400 border border-green-500/20' : 'bg-yellow-900/50 text-yellow-400 border border-yellow-500/20')}`}>
                                        {user.role === UserRole.ROOT ? t.layout.unrestricted : user.licenseType}
                                    </div>
                                    {user.licenseType === LicenseType.TRIAL && user.role !== UserRole.ROOT && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400 text-sm">{t.settings.expiresIn} 15 {t.layout.daysLeft}</span>
                                            <button onClick={forceTrialExpiry} title="Encurtar Trial para 1 Minuto" className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded hover:bg-amber-500/30 transition-colors border border-amber-500/30">Validar (1min)</button>
                                        </div>
                                    )}
                                </div>
                                
                                {user.role !== UserRole.ROOT && (
                                    <div className="flex items-center gap-3 text-slate-300 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                                        <CalendarIcon size={20} className="text-blue-400" />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">{t.settings.validUntil}</span>
                                            <span className="text-base font-bold text-white">{getExpiryDate()}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {user.licenseType !== LicenseType.PRO && user.role !== UserRole.ROOT && (
                                <div className="mt-8 pt-8 border-t border-slate-700/50">
                                    <label className="block text-slate-100 font-medium mb-3">{t.settings.activate}</label>
                                    <div className="flex space-x-2">
                                        <input 
                                            type="text" 
                                            value={licenseInput}
                                            onChange={(e) => setLicenseInput(e.target.value)}
                                            placeholder={t.settings.enterKey}
                                            className="flex-1 app-select"
                                        />
                                        <button 
                                            onClick={redeemLicense}
                                            className="bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-2 rounded transition-all shadow-lg shadow-green-900/40"
                                        >
                                            {t.settings.activateBtn}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        {user.role === UserRole.ROOT && <AdminPanel lang={lang} />}
                    </div>
                ) : page === 'permissions' && user.role !== UserRole.ROOT ? (
                    <PermissionsPanel user={user} lang={lang} />
                ) : page === 'clients' && user.role === UserRole.ROOT ? (
                    <ClientManager lang={lang} />
                ) : null}
            </div>
         </div>
      )}

      {page === 'history' && <HistoryView history={history} lang={lang} />}

      {page === 'jobs' && (
        <div>
          {isEditing ? (
            <JobEditor 
              job={editingJob} 
              destinations={destinations} 
              onSave={saveJob} 
              onCancel={() => { setIsEditing(false); setEditingJob(undefined); }}
              isTrialExpired={user.licenseType === LicenseType.EXPIRED}
              lang={lang}
            />
          ) : (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t.jobs.title}</h2>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-blue-900/40"
                >
                  {t.jobs.createNew}
                </button>
              </div>
              <div className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                <table className="w-full text-left">
                  <thead className="bg-slate-700/50 text-slate-300">
                    <tr>
                      <th className="p-4">{t.jobs.jobName}</th>
                      <th className="p-4">{t.jobs.type}</th>
                      <th className="p-4">{t.jobs.schedule}</th>
                      <th className="p-4">{t.jobs.lastRun}</th>
                      <th className="p-4">{t.jobs.statusColumn}</th>
                      <th className="p-4 text-right">{t.jobs.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {jobs.map(job => (
                      <tr key={job.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-4 font-medium">{job.name}</td>
                        <td className="p-4 text-slate-400">{job.backupType}</td>
                        <td className="p-4 text-sm text-slate-300" title={job.scheduleCron}>{parseCronToText(job.scheduleCron, t)}</td>
                        <td className="p-4 text-sm">{job.lastRun ? new Date(job.lastRun).toLocaleString() : t.dashboard.never}</td>
                        <td className="p-4">
                           {job.status === 'RUNNING' && <span className="text-blue-400 animate-pulse">{t.jobs.running}</span>}
                           {job.status === 'SUCCESS' && <span className="text-green-400 flex items-center gap-1"><CheckCircleIcon size={14}/> {t.jobs.successStatus}</span>}
                           {job.status === 'ERROR' && <span className="text-red-400 flex items-center gap-1"><AlertTriangleIcon size={14}/> {t.jobs.failedStatus}</span>}
                           {job.status === 'IDLE' && <span className="text-slate-500">{t.jobs.idleStatus}</span>}
                        </td>
                        <td className="p-4 flex justify-end space-x-2">
                          <button onClick={() => runJob(job.id)} title={t.jobs.runNow} className="p-2 bg-green-900/50 text-green-400 rounded hover:bg-green-900 transition-colors"><PlayIcon size={16} /></button>
                          <button onClick={() => { setEditingJob(job); setIsEditing(true); }} title={t.jobs.edit} className="p-2 bg-blue-900/50 text-blue-400 rounded hover:bg-blue-900 transition-colors"><EditIcon size={16} /></button>
                          <button onClick={() => deleteJob(job.id)} title={t.jobs.delete} className="p-2 bg-red-900/50 text-red-400 rounded hover:bg-red-900 transition-colors"><TrashIcon size={16} /></button>
                        </td>
                      </tr>
                    ))}
                     {jobs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">{t.dashboard.noJobs}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Backup Progress Modal */}
      {currentModalTaskId && activeTasks[currentModalTaskId] && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            {/* Header */}
            <div className="bg-slate-800/50 p-6 border-b border-slate-700 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${activeTasks[currentModalTaskId].status === 'RUNNING' ? 'bg-blue-500/20 text-blue-400' : activeTasks[currentModalTaskId].status === 'SUCCESS' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                   {activeTasks[currentModalTaskId].status === 'RUNNING' ? <LoaderIcon className="animate-spin" size={28} /> : activeTasks[currentModalTaskId].status === 'SUCCESS' ? <CheckCircleIcon size={28} /> : <AlertTriangleIcon size={28} />}
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {activeTasks[currentModalTaskId].status === 'RUNNING' ? 'Executando Backup...' : activeTasks[currentModalTaskId].status === 'SUCCESS' ? 'Backup Concluído!' : 'Falha no Backup'}
                  </h3>
                  <p className="text-sm text-slate-400 font-medium">{activeTasks[currentModalTaskId].jobName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentModalTaskId(null)} 
                  className="text-slate-400 hover:text-white transition-all p-2 hover:bg-white/5 rounded-lg flex items-center gap-2 border border-slate-700"
                  title="Minimizar para rodapé"
                >
                  <ArrowDownIcon size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Minimizar</span>
                </button>
                {activeTasks[currentModalTaskId].status !== 'RUNNING' && (
                  <button onClick={() => {
                    const tid = currentModalTaskId;
                    setCurrentModalTaskId(null);
                    setActiveTasks(prev => {
                      const next = { ...prev };
                      delete next[tid];
                      return next;
                    });
                  }} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg">
                    <XIcon size={24} />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Paths Visualization */}
              <div className="grid grid-cols-1 gap-4 p-5 bg-slate-950/60 rounded-xl border border-slate-800 shadow-inner">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Origem dos Dados</p>
                  </div>
                  <p className="text-xs sm:text-sm font-mono break-all text-blue-400 pl-3.5 leading-relaxed bg-blue-500/5 p-3 rounded-lg border border-blue-500/10">
                    {activeTasks[currentModalTaskId].sourcePath}
                  </p>
                </div>

                <div className="flex justify-center -my-3 relative z-10">
                    <div className="bg-slate-900 p-2 rounded-full border border-slate-700 shadow-xl">
                        <div className={activeTasks[currentModalTaskId].status === 'RUNNING' ? 'animate-bounce' : ''}>
                           <ArrowDownIcon className="text-slate-400 w-5 h-5" />
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Destino do Backup</p>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                  </div>
                  <div className="space-y-2 pl-3.5">
                    {destinations.filter(d => activeTasks[currentModalTaskId].destinationIds?.includes(d.id)).map(d => (
                      <p key={d.id} className="text-xs sm:text-sm font-mono break-all text-green-400 leading-relaxed bg-green-500/5 p-3 rounded-lg border border-green-500/10 w-full text-left">
                        {d.pathOrBucket}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Progress Detail */}
              <div className="space-y-4 px-1">
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Progresso da Migração</span>
                  <span className={`font-black tracking-tight ${activeTasks[currentModalTaskId].status === 'ERROR' ? 'text-red-400' : 'text-white'}`}>
                    {activeTasks[currentModalTaskId].status === 'RUNNING' ? 'Sincronizando blocos...' : activeTasks[currentModalTaskId].status === 'SUCCESS' ? '100% - OK' : 'Ocorreu um erro'}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out rounded-full ${activeTasks[currentModalTaskId].status === 'RUNNING' ? 'w-2/3 bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.3)]' : activeTasks[currentModalTaskId].status === 'SUCCESS' ? 'w-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'w-1/3 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`}
                  ></div>
                </div>
              </div>

              {/* Detailed Process Logs */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-1">
                   <div className="flex items-center gap-2">
                       <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{lang === 'pt' ? 'Detalhamento do Processo' : 'Process Details'}</h4>
                   </div>
                   <button 
                     onClick={() => setShowRealTime(!showRealTime)}
                     className={`text-[9px] px-3 py-1 rounded-full border transition-all font-bold uppercase tracking-tighter ${showRealTime ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
                   >
                     {showRealTime ? (lang === 'pt' ? 'Modo Real-Time: ON' : 'Real-Time Mode: ON') : (lang === 'pt' ? 'Ativar Real-Time' : 'Enable Real-Time')}
                   </button>
                </div>

                <div className="bg-slate-950/40 rounded-xl border border-slate-800/50 p-4 space-y-3">
                   {/* Preparation Steps */}
                   {!showRealTime && (
                     <div className="space-y-2.5">
                        {activeTasks[currentModalTaskId].prepSteps?.map((step: any, idx: number) => (
                           <div key={idx} className="flex items-center justify-between group">
                             <div className="flex items-center gap-3">
                                {step.status === 'done' ? (
                                  <CheckCircleIcon size={14} className="text-emerald-500" />
                                ) : step.status === 'active' ? (
                                  <LoaderIcon size={14} className="text-blue-400 animate-spin" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full border border-slate-700"></div>
                                )}
                                <span className={`text-[11px] font-medium transition-colors ${step.status === 'done' ? 'text-slate-400' : step.status === 'active' ? 'text-blue-300' : 'text-slate-600'}`}>
                                  {step.msg}
                                </span>
                             </div>
                             {step.status === 'done' && <span className="text-[9px] font-black text-emerald-500/60 uppercase">OK</span>}
                           </div>
                        ))}
                     </div>
                   )}

                   {/* Active File Migration */}
                   {activeTasks[currentModalTaskId].status === 'RUNNING' && showRealTime && (
                     <div className="space-y-2 animate-in fade-in duration-300">
                        {activeTasks[currentModalTaskId].results.flatMap((r: any) => r.processedFiles || []).length > 0 ? (
                          activeTasks[currentModalTaskId].results.flatMap((r: any) => r.processedFiles || []).map((file: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-3 bg-blue-500/5 p-2 rounded-lg border border-blue-500/10 animate-in slide-in-from-bottom-2 duration-300">
                               <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                               <span className="text-[11px] font-mono text-blue-300 truncate flex-1">{file}</span>
                               <span className="text-[9px] font-black text-blue-500 uppercase italic">Sincronizando...</span>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center">
                             <LoaderIcon className="mx-auto text-slate-700 animate-spin mb-3" size={24} />
                             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{lang === 'pt' ? 'Aguardando fluxo de dados...' : 'Waiting for data stream...'}</p>
                          </div>
                        )}
                     </div>
                   )}

                   {/* Standard Running View */}
                   {activeTasks[currentModalTaskId].status === 'RUNNING' && !showRealTime && (
                     <div className="pt-3 mt-3 border-t border-slate-800/50 space-y-3 animate-in fade-in duration-700">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <ServerIcon size={14} className="text-blue-400" />
                              <span className="text-[11px] font-bold text-white animate-pulse">
                                {lang === 'pt' ? 'Migrando arquivos...' : 'Migrating files...'}
                              </span>
                           </div>
                        </div>
                        <div className="space-y-2">
                           {[1, 2].map((i) => (
                              <div key={i} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/5 opacity-50">
                                 <div className="w-2 h-2 rounded-full bg-blue-500/40 animate-ping"></div>
                                 <div className="h-2 w-24 bg-slate-800 rounded animate-pulse"></div>
                                 <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500/20 w-1/3 animate-shimmer"></div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                   )}

                   {/* Real processed files after success */}
                   {activeTasks[currentModalTaskId].status === 'SUCCESS' && activeTasks[currentModalTaskId].results.length > 0 && (
                     <div className="pt-3 mt-3 border-t border-slate-800/50 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {activeTasks[currentModalTaskId].results.flatMap((r: any) => r.processedFiles || []).slice(0, 10).map((file: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 animate-in slide-in-from-left-2 duration-300">
                             <CheckCircleIcon size={12} className="text-emerald-500" />
                             <span className="text-[11px] font-mono text-emerald-400 truncate flex-1">{file}</span>
                             <div className="flex items-center gap-2">
                                <div className="h-1 w-12 bg-emerald-900/50 rounded-full overflow-hidden">
                                   <div className="h-full bg-emerald-500 w-full"></div>
                                </div>
                                <span className="text-[9px] font-black text-emerald-500 uppercase italic">Concluído</span>
                             </div>
                          </div>
                        ))}
                     </div>
                   )}
                </div>
              </div>

              {/* Results Log */}
              {activeTasks[currentModalTaskId].results.length > 0 && (
                <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Relatório de Integridade</p>
                    <div className="text-[9px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 font-bold tracking-tight">
                      {activeTasks[currentModalTaskId].results.reduce((acc: number, curr: any) => acc + (curr.fileCount || 0), 0)} Arquivos Sincronizados
                    </div>
                  </div>
                  <div className="space-y-3">
                    {activeTasks[currentModalTaskId].results.map((res: any, i: number) => (
                      <div key={i} className={`p-4 rounded-xl border transition-all duration-300 ${res.status === 'ERROR' ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-900/80 border-slate-700/50 shadow-lg'}`}>
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded-lg ${res.status === 'ERROR' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                {res.status === 'ERROR' ? <ShieldAlertIcon size={16}/> : <CheckCircleIcon size={16}/>}
                              </div>
                              <span className={`text-sm font-black tracking-tight ${res.status === 'ERROR' ? 'text-red-400' : 'text-slate-100'}`}>{res.destination}</span>
                           </div>
                        </div>
                        <div className="flex justify-between items-center">
                           <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-[85%]">
                             {res.status === 'ERROR' ? res.message : `Backup concluído: ${res.fileCount} arquivo(s) processados e validados.`}
                           </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-800/30 border-t border-slate-700 flex justify-end items-center gap-4 shrink-0">
              {activeTasks[currentModalTaskId].status === 'RUNNING' && (
                <button 
                  onClick={() => interruptBackup(currentModalTaskId!)}
                  className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-300 border border-red-500/20"
                >
                  Interromper Execução
                </button>
              )}
              <button 
                onClick={() => {
                  if (activeTasks[currentModalTaskId].status !== 'RUNNING') {
                    const tid = currentModalTaskId;
                    setActiveTasks(prev => {
                      const next = { ...prev };
                      delete next[tid];
                      return next;
                    });
                  }
                  setCurrentModalTaskId(null);
                }}
                className={`px-8 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 ${activeTasks[currentModalTaskId].status === 'RUNNING' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/40 transform hover:-translate-y-0.5 active:translate-y-0' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/40 transform hover:-translate-y-0.5 active:translate-y-0'}`}
              >
                {activeTasks[currentModalTaskId].status === 'RUNNING' ? 'Continuar em Background' : 'Fechar Relatório'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Task Bar - Floating Footer Manager */}
      {Object.keys(activeTasks).length > 0 && !currentModalTaskId && (
        <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3 pointer-events-none">
           {Object.entries(activeTasks).map(([tid, task]) => (
             <div 
               key={tid} 
               onClick={() => setCurrentModalTaskId(tid)}
               className="pointer-events-auto bg-slate-900/90 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-4 shadow-2xl flex items-center gap-4 cursor-pointer hover:border-blue-400 hover:scale-105 transition-all animate-in slide-in-from-bottom-10"
             >
                <div className={`p-2 rounded-lg ${task.status === 'RUNNING' ? 'bg-blue-500/20 text-blue-400' : task.status === 'SUCCESS' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                   {task.status === 'RUNNING' ? <LoaderIcon className="animate-spin" size={20} /> : task.status === 'SUCCESS' ? <CheckCircleIcon size={20} /> : <AlertTriangleIcon size={20} />}
                </div>
                <div className="min-w-[150px]">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-none mb-1">Backup em Curso</p>
                   <p className="text-sm font-bold text-white leading-tight">{task.jobName}</p>
                   {task.status === 'RUNNING' && (
                     <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-1/2 animate-pulse"></div>
                     </div>
                   )}
                </div>
                {task.status !== 'RUNNING' && (
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       setActiveTasks(prev => {
                         const next = { ...prev };
                         delete next[tid];
                         return next;
                       });
                     }}
                     className="text-slate-500 hover:text-white"
                   >
                     <XIcon size={16} />
                   </button>
                )}
             </div>
           ))}
        </div>
      )}
    </Layout>
  );
}
