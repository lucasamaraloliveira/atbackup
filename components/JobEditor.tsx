

import React, { useState } from 'react';
import { BackupJob, BackupType, Destination, SourceType, Language } from '../types';
import { Save, X, Wand2, Search, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { generateBackupScript } from '../services/geminiService';
import { DataService } from '../services/storageService';
import { useTranslation } from '../utils/translations';

interface JobEditorProps {
  job?: BackupJob;
  destinations: Destination[];
  onSave: (job: BackupJob) => void;
  onCancel: () => void;
  isTrialExpired: boolean;
  lang: Language;
}

const JobEditor: React.FC<JobEditorProps> = ({ job, destinations, onSave, onCancel, isTrialExpired, lang }) => {
  const t = useTranslation(lang);
  const [formData, setFormData] = useState<BackupJob>(job || {
    id: crypto.randomUUID(),
    name: '',
    sourceType: SourceType.DIRECTORY,
    sourcePath: '',
    destinationIds: [],
    backupType: BackupType.INCREMENTAL,
    scheduleCron: '0 2 * * *',
    compress: false,
    notifyOnSuccess: true,
    notifyOnWarning: true,
    notifyOnError: true,
    notifyEmail: '',
    status: 'IDLE'
  });

  // Schedule UI State
  const [schedFreq, setSchedFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [schedTime, setSchedTime] = useState('02:00');
  const [schedDays, setSchedDays] = useState<number[]>([]);
  const [schedDayOfMonth, setSchedDayOfMonth] = useState<number>(1);

  // Integrity Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ corrupted: string[] } | null>(null);
  const [showScanConfirm, setShowScanConfirm] = useState(false);

  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Parse initial cron for UI
  React.useEffect(() => {
    if (job) {
      // This is a simplified parser for demo. A real one would use a cron library.
      const parts = job.scheduleCron.split(' ');
      if (parts.length >= 5) {
        setSchedTime(`${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`);
        if (parts[4] !== '*') {
          setSchedFreq('weekly');
          setSchedDays(parts[4].split(',').map(Number));
        } else if (parts[2] !== '*') {
          setSchedFreq('monthly');
          setSchedDayOfMonth(parseInt(parts[2]));
        } else {
          setSchedFreq('daily');
        }
      }
    }
  }, [job]);

  // Update cron when UI changes
  React.useEffect(() => {
    const [hour, minute] = schedTime.split(':');
    let cron = `${parseInt(minute)} ${parseInt(hour)} * * *`;

    if (schedFreq === 'weekly') {
      const days = schedDays.length > 0 ? schedDays.join(',') : '*';
      cron = `${parseInt(minute)} ${parseInt(hour)} * * ${days}`;
    } else if (schedFreq === 'monthly') {
      cron = `${parseInt(minute)} ${parseInt(hour)} ${schedDayOfMonth} * *`;
    }

    setFormData(prev => ({ ...prev, scheduleCron: cron }));
  }, [schedFreq, schedTime, schedDays, schedDayOfMonth]);

  const handleGenerateScript = async () => {
    setLoadingAi(true);
    const script = await generateBackupScript(formData, destinations);
    setGeneratedScript(script);
    setLoadingAi(false);
  };

  const handleNativeBrowse = async () => {
    try {
      const type = formData.sourceType === SourceType.FILE ? 'file' : 'directory';
      const response = await fetch(`/api/browse?type=${type}`);
      const data = await response.json();
      if (data.path) {
        handlePathSelect(data.path);
      }
    } catch (error) {
      console.error('Failed to open native browser', error);
    }
  };

  const handleDestChange = (destId: string) => {
    setFormData(prev => {
      const exists = prev.destinationIds.includes(destId);
      if (isTrialExpired && !exists && prev.destinationIds.length >= 1) {
        alert(t.jobs.trialLimit);
        return prev;
      }
      if (exists) {
        return { ...prev, destinationIds: prev.destinationIds.filter(id => id !== destId) };
      } else {
        return { ...prev, destinationIds: [...prev.destinationIds, destId] };
      }
    });
  };

  const handlePathSelect = async (path: string) => {
    setFormData(prev => ({ ...prev, sourcePath: path }));

    // Trigger scan if Directory
    if (formData.sourceType === SourceType.DIRECTORY || formData.sourceType === SourceType.FILE) {
      setIsScanning(true);
      const result = await DataService.mockScanIntegrity(path);
      setIsScanning(false);

      if (result.corrupted.length > 0) {
        setScanResult(result);
        setShowScanConfirm(true);
      }
    }
  };

  const toggleDay = (day: number) => {
    setSchedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700/50 p-6 max-w-4xl mx-auto shadow-xl relative">
      {/* Scan Modal */}
      {showScanConfirm && scanResult && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl p-4">
          <div className="bg-slate-900 border border-red-500/50 rounded-lg p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <AlertTriangle size={32} />
              <h3 className="text-xl font-bold">{t.jobs.scanCorrupt}</h3>
            </div>
            <p className="text-slate-300 mb-4">{t.jobs.scanCorruptMsg}</p>
            <ul className="bg-slate-950 p-3 rounded mb-6 text-sm font-mono text-red-300 max-h-32 overflow-y-auto">
              {scanResult.corrupted.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowScanConfirm(false); setFormData({ ...formData, sourcePath: '' }); }} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
              <button onClick={() => setShowScanConfirm(false)} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-medium">{t.jobs.proceed}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{job ? t.jobs.editJob : t.jobs.newJob}</h2>
        <button onClick={onCancel} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">{t.jobs.jobName}</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
            placeholder="e.g. Daily DB Backup"
          />
        </div>

        {/* Improved Schedule UI */}
        <div className="border-t border-slate-700/50 pt-4">
          <h3 className="text-lg font-semibold mb-3 text-blue-400">{t.jobs.schedule}</h3>
          <div className="flex flex-wrap gap-4 items-end bg-slate-900/50 p-4 rounded-lg">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.jobs.frequency}</label>
              <select value={schedFreq} onChange={(e: any) => setSchedFreq(e.target.value)} className="bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none">
                <option value="daily">{t.jobs.schedDaily}</option>
                <option value="weekly">{t.jobs.schedWeekly}</option>
                <option value="monthly">{t.jobs.schedMonthly}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.jobs.schedTime}</label>
              <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none" />
            </div>
            {schedFreq === 'weekly' && (
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1">{t.jobs.schedDays}</label>
                <div className="flex gap-2 flex-wrap">
                  {t.jobs.weekDaysShort.map((dayLabel: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => toggleDay(index)}
                      className={`w-10 h-8 rounded text-xs font-bold ${schedDays.includes(index) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                    >
                      {dayLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {schedFreq === 'monthly' && (
              <div>
                 <label className="block text-xs text-slate-400 mb-1">Dia do Mês</label>
                 <select 
                   value={schedDayOfMonth} 
                   onChange={(e) => setSchedDayOfMonth(parseInt(e.target.value))}
                   className="bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none"
                 >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                 </select>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">Cron: {formData.scheduleCron}</p>
        </div>

        {/* Source Configuration */}
        <div className="border-t border-slate-700/50 pt-4">
          <h3 className="text-lg font-semibold mb-3 text-blue-400">{t.jobs.source}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t.jobs.sourceType}</label>
              <select
                value={formData.sourceType}
                onChange={e => setFormData({ ...formData, sourceType: e.target.value as SourceType })}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
              >
                <option value={SourceType.FILE}>{t.jobs.sourceTypes.file}</option>
                <option value={SourceType.DIRECTORY}>{t.jobs.sourceTypes.directory}</option>
                <option value={SourceType.DATABASE_MYSQL}>{t.jobs.sourceTypes.mysql}</option>
                <option value={SourceType.DATABASE_POSTGRES}>{t.jobs.sourceTypes.postgres}</option>
                <option value={SourceType.DATABASE_MONGO}>{t.jobs.sourceTypes.mongo}</option>
                <option value={SourceType.DATABASE_SQLSERVER}>{t.jobs.sourceTypes.sqlserver}</option>
              </select>
            </div>
            
            {/* Show Path/ConnString only if not using individual fields or if it's a file/dir */}
            {(!formData.sourceType.includes('Database') || !formData.dbCredentials?.useIndividualFields) && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  {formData.sourceType.includes('Database') ? t.jobs.useConnString : t.jobs.path}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formData.sourcePath}
                    onChange={e => setFormData({ ...formData, sourcePath: e.target.value })}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                    placeholder={formData.sourceType.includes('Database') ? 'user:password@localhost:3306/db' : '/var/www/html'}
                  />
                    {(formData.sourceType === SourceType.FILE || formData.sourceType === SourceType.DIRECTORY) && (
                      <div className="flex gap-2">
                        <button 
                          onClick={handleNativeBrowse}
                          className="app-select flex items-center justify-center aspect-square"
                          title="Abrir Seletor do Windows"
                        >
                            <Search size={18} />
                        </button>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Database Specific Fields Overlay */}
          {formData.sourceType.includes('Database') && (
            <div className="mt-4 p-4 bg-slate-900/40 rounded-lg border border-slate-700/50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">Configuração do Banco</span>
                <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-400 hover:text-white transition-colors">
                   <input 
                     type="checkbox" 
                     checked={formData.dbCredentials?.useIndividualFields || false} 
                     onChange={e => setFormData({
                       ...formData, 
                       dbCredentials: { ...(formData.dbCredentials || {}), useIndividualFields: e.target.checked }
                     })}
                     className="accent-blue-500"
                   />
                   Preencher campos individualmente
                </label>
              </div>

              {formData.dbCredentials?.useIndividualFields && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t.jobs.dbHost}</label>
                    <input 
                      type="text" 
                      value={formData.dbCredentials?.host || ''} 
                      onChange={e => setFormData({...formData, dbCredentials: {...(formData.dbCredentials || {}), host: e.target.value}})}
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-blue-500"
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t.jobs.dbPort}</label>
                    <input 
                      type="text" 
                      value={formData.dbCredentials?.port || ''} 
                      onChange={e => setFormData({...formData, dbCredentials: {...(formData.dbCredentials || {}), port: e.target.value}})}
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-blue-500"
                      placeholder="1433"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t.jobs.dbName}</label>
                    <input 
                      type="text" 
                      value={formData.dbCredentials?.database || ''} 
                      onChange={e => setFormData({...formData, dbCredentials: {...(formData.dbCredentials || {}), database: e.target.value}})}
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-blue-500"
                      placeholder="WLDADOS"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t.jobs.dbUser}</label>
                    <input 
                      type="text" 
                      value={formData.dbCredentials?.user || ''} 
                      onChange={e => setFormData({...formData, dbCredentials: {...(formData.dbCredentials || {}), user: e.target.value}})}
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-blue-500"
                      placeholder="sa"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t.jobs.dbPassword}</label>
                    <input 
                      type="password" 
                      value={formData.dbCredentials?.password || ''} 
                      onChange={e => setFormData({...formData, dbCredentials: {...(formData.dbCredentials || {}), password: e.target.value}})}
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-blue-500"
                      placeholder="******"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compression Options */}
        <div className="border-t border-slate-700/50 pt-4">
          <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-700/50 flex items-start gap-4">
            <div className="pt-1">
              <input
                type="checkbox"
                checked={formData.compress || false}
                onChange={e => setFormData({ ...formData, compress: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-800 border-slate-600 accent-blue-600 cursor-pointer"
                id="compress-checkbox"
              />
            </div>
            <div>
              <label htmlFor="compress-checkbox" className="block text-sm font-bold text-slate-200 cursor-pointer mb-1">
                {t.jobs.compress}
              </label>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t.jobs.compressDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Destination Selection */}
        <div className="border-t border-slate-700/50 pt-4">
          <h3 className="text-lg font-semibold mb-3 text-blue-400">{t.jobs.destinations}</h3>
          {isTrialExpired && <p className="text-xs text-red-400 mb-2">{t.jobs.trialLimit}</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {destinations.map(dest => (
              <div
                key={dest.id}
                onClick={() => handleDestChange(dest.id)}
                className={`p-3 rounded border cursor-pointer transition-all ${formData.destinationIds.includes(dest.id)
                    ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                    : 'bg-slate-900 border-slate-600 hover:border-slate-500'
                  }`}
              >
                <p className="font-bold text-sm">{dest.name}</p>
                <p className="text-xs text-slate-400">{dest.type}</p>
              </div>
            ))}
            {destinations.length === 0 && <p className="text-slate-500 text-sm">{t.jobs.noDestinations}</p>}
          </div>
        </div>

        {/* Backup Options */}
        <div className="border-t border-slate-700/50 pt-4">
          <h3 className="text-lg font-semibold mb-3 text-blue-400">{t.jobs.options}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t.jobs.backupType}</label>
              <select
                value={formData.backupType}
                onChange={e => setFormData({ ...formData, backupType: e.target.value as BackupType })}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
              >
                {Object.values(BackupType).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t.jobs.notifyEmail}</label>
              <input
                type="email"
                value={formData.notifyEmail}
                onChange={e => setFormData({ ...formData, notifyEmail: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                placeholder="admin@example.com"
              />
            </div>
          </div>
          <div className="flex space-x-4 mt-3">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.notifyOnSuccess}
                onChange={e => setFormData({ ...formData, notifyOnSuccess: e.target.checked })}
                className="rounded bg-slate-900 border-slate-600 accent-blue-600"
              />
              <span className="text-sm">{t.jobs.notifySuccess}</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.notifyOnError}
                onChange={e => setFormData({ ...formData, notifyOnError: e.target.checked })}
                className="rounded bg-slate-900 border-slate-600 accent-blue-600"
              />
              <span className="text-sm">{t.jobs.notifyError}</span>
            </label>
          </div>
        </div>

        {/* AI Assistant */}
        <div className="border-t border-slate-700/50 pt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-purple-400 flex items-center gap-2">
              <Wand2 size={18} /> {t.jobs.aiGenerator}
            </h3>
            <button
              type="button"
              onClick={handleGenerateScript}
              disabled={loadingAi}
              className="text-xs bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-white disabled:opacity-50 transition-colors shadow-lg shadow-purple-900/30"
            >
              {loadingAi ? t.jobs.generating : t.jobs.generate}
            </button>
          </div>
          {generatedScript && (
            <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-green-400 whitespace-pre-wrap h-40 overflow-y-auto border border-slate-700/50 custom-scrollbar">
              {generatedScript}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700/50">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-slate-300 hover:text-white transition-colors"
          >
            {t.jobs.cancel}
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center space-x-2 transition-all hover:shadow-lg hover:shadow-blue-900/40"
          >
            <Save size={18} />
            <span>{t.jobs.save}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobEditor;