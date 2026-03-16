import React, { useState, useEffect, useMemo } from 'react';
import { DataService } from '../services/storageService';
import { LicenseKey, Language } from '../types';
import { Copy, Check, Trash2, AlertTriangle, RotateCcw, X, Key, Search } from 'lucide-react';
import { useTranslation } from '../utils/translations';

interface AdminPanelProps {
  lang: Language;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ lang }) => {
  const t = useTranslation(lang);
  const [licenses, setLicenses] = useState<LicenseKey[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(365);
  const [searchTerm, setSearchTerm] = useState('');

  // Delete & Undo state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [licToDelete, setLicToDelete] = useState<LicenseKey | null>(null);
  const [undoLic, setUndoLic] = useState<LicenseKey | null>(null);

  useEffect(() => {
    loadLicenses();
  }, []);

  const loadLicenses = () => {
    setLicenses(DataService.getAllLicenses());
  };

  const filteredLicenses = useMemo(() => {
    return licenses.filter(lic => 
      lic.key.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (lic.redeemedBy && lic.redeemedBy.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [licenses, searchTerm]);

  const generate = () => {
    DataService.generateLicense(duration);
    loadLicenses();
  };

  const triggerDelete = (lic: LicenseKey) => {
    setLicToDelete(lic);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (licToDelete) {
      setUndoLic(licToDelete);
      DataService.deleteLicense(licToDelete.key);
      loadLicenses();
      setShowDeleteModal(false);
      setLicToDelete(null);

      // Clear undo after 10 seconds
      setTimeout(() => setUndoLic(null), 10000);
    }
  };

  const restoreLic = () => {
    if (undoLic) {
      DataService.restoreLicense(undoLic);
      loadLicenses();
      setUndoLic(null);
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 relative">
      {/* Undo Toast */}
      {undoLic && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right duration-300">
          <div className="bg-slate-900 border border-amber-500/30 rounded-lg p-4 shadow-2xl flex items-center gap-4">
            <div className="text-amber-400">
               <RotateCcw className="animate-spin-slow" size={20} />
            </div>
            <div>
              <p className="text-white text-sm font-medium">{t.settings.licenseDeleted}</p>
              <p className="text-slate-400 text-xs font-mono">{undoLic.key}</p>
            </div>
            <button 
              onClick={restoreLic}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
            >
              {t.settings.undo}
            </button>
            <button onClick={() => setUndoLic(null)} className="text-slate-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-4 w-full md:w-auto">
          <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <Key size={24} />
            {t.admin.title}
          </h2>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-slate-400">{t.admin.duration}:</label>
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="bg-slate-800 border border-slate-600 rounded p-1 text-sm outline-none text-amber-200 focus:border-amber-500"
            >
              <option value={10}>10 {t.admin.days}</option>
              <option value={15}>15 {t.admin.days}</option>
              <option value={30}>30 {t.admin.days}</option>
              <option value={60}>60 {t.admin.days}</option>
              <option value={180}>180 {t.admin.days}</option>
              <option value={365}>365 {t.admin.days}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
             <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
             <input 
               type="text"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               placeholder={t.admin.searchPlaceholder}
               className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
             />
          </div>
          <button
            onClick={generate}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-xl shadow-lg shadow-amber-900/50 font-bold transition-all active:scale-95 whitespace-nowrap"
          >
            {t.admin.generate}
          </button>
        </div>
      </div>

      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest whitespace-nowrap">
              <tr>
                <th className="p-4">{t.admin.key}</th>
                <th className="p-4">{t.admin.duration}</th>
                <th className="p-4">{t.admin.created}</th>
                <th className="p-4">{t.admin.status}</th>
                <th className="p-4">{t.admin.redeemedBy}</th>
                <th className="p-4">{t.admin.activatedAt}</th>
                <th className="p-4 text-right px-8">{t.admin.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredLicenses.map((lic) => (
                <tr key={lic.key} className="hover:bg-slate-700/30 transition-colors group">
                  <td className="p-4 font-mono text-xs group-hover:text-amber-300 transition-colors whitespace-nowrap">{lic.key}</td>
                  <td className="p-4 text-sm text-amber-200 whitespace-nowrap">{lic.durationDays || 365} {t.admin.days}</td>
                  <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                    {new Date(lic.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-[9px] uppercase font-black tracking-widest ${lic.redeemedBy ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'}`}>
                      {lic.redeemedBy ? t.admin.active : t.admin.available}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-bold text-white whitespace-nowrap truncate max-w-[150px]">{lic.redeemedBy || '-'}</td>
                  <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                    {lic.redeemedAt ? new Date(lic.redeemedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-4 text-right px-6 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => copyToClipboard(lic.key)}
                        className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all"
                        title="Copy Key"
                      >
                        {copied === lic.key ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                      <button
                        onClick={() => triggerDelete(lic)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="Delete Key"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLicenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-slate-500 italic">
                    {searchTerm ? "No results found for your search." : t.admin.noLicenses}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-sm w-full p-8 shadow-2xl text-center animate-modal-pop">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 font-black scale-up">
               <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{t.jobs.delete}</h3>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              {t.admin.deleteConfirm}
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={confirmDelete}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-900/40 active:scale-[0.98]"
              >
                {t.jobs.delete}
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-3.5 text-slate-400 hover:text-white font-medium transition-colors"
              >
                {t.destinations.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
