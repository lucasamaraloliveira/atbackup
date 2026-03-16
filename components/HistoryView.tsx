
import React from 'react';
import { BackupHistory, Language } from '../types';
import { useTranslation } from '../utils/translations';
import { CheckCircle, ShieldAlert, FileText, Calendar, Clock, Database, HardDrive } from 'lucide-react';

interface HistoryViewProps {
  history: BackupHistory[];
  lang: Language;
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, lang }) => {
  const t = useTranslation(lang);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock className="text-blue-500" />
          {t.history.title}
        </h2>
      </div>

      <div className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
        {history.length === 0 ? (
          <div className="p-12 text-center">
            <Database size={48} className="mx-auto text-slate-600 mb-4 opacity-20" />
            <p className="text-slate-400">{t.history.noHistory}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-700/50 text-slate-300">
                <tr>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">{t.history.tableJob}</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">{t.history.tableDate}</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">{t.history.tableStatus}</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">{t.history.tableFiles}</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">{t.history.tableIntegrity}</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">{t.history.tableDetails}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100">{item.jobName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">ID: {item.jobId.substring(0, 8)}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">
                      <div className="flex items-center gap-2">
                         <Calendar size={12} className="text-slate-500" />
                         {formatDate(item.timestamp)}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                        item.status === 'SUCCESS' 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-blue-400 font-bold">
                       {item.fileCount}
                    </td>
                    <td className="p-4">
                      {item.integrity ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-black text-[9px] tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle size={10} />
                          {t.history.integrityOk}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-red-400 font-black text-[9px] tracking-tighter bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                          <ShieldAlert size={10} />
                          {t.history.integrityFailed}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                       <p className="text-xs text-slate-400 line-clamp-1 max-w-[200px]" title={item.details}>
                         {item.details}
                       </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
