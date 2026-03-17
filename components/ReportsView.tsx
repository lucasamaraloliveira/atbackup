
import React, { useState } from 'react';
import { Language, BackupJob, Destination, BackupHistory, User } from '../types';
import { useTranslation } from '../utils/translations';
import { FileText, Download, PieChart, Database, ShieldCheck, History, ArrowRight, X, ExternalLink, Printer } from 'lucide-react';

interface ReportsViewProps {
  lang: Language;
  jobs: BackupJob[];
  destinations: Destination[];
  history: BackupHistory[];
  users?: User[]; // For root to see client reports
}

const ReportsView: React.FC<ReportsViewProps> = ({ lang, jobs, destinations, history, users = [] }) => {
  const t = useTranslation(lang);
  const now = new Date().toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const reportCards = [
    {
      id: 'jobs',
      title: t.reports.types.jobs,
      icon: <PieChart size={24} className="text-blue-400" />,
      desc: lang === 'pt' ? 'Consolidado de todas as tarefas, agendamentos e status atual.' : 'Summary of all jobs, schedules, and current health.',
      stats: `${jobs.length} ${lang === 'pt' ? 'Tarefas' : 'Jobs'}`
    },
    {
      id: 'storage',
      title: t.reports.types.storage,
      icon: <Database size={24} className="text-emerald-400" />,
      desc: lang === 'pt' ? 'Ocupação por destino, volumetria e mapeamento de caminhos.' : 'Usage per destination, volume, and path mapping.',
      stats: `${destinations.length} ${lang === 'pt' ? 'Destinos' : 'Destinations'}`
    },
    {
      id: 'history',
      title: t.reports.types.history,
      icon: <History size={24} className="text-amber-400" />,
      desc: lang === 'pt' ? 'Log completo de auditoria para conformidade e compliance.' : 'Full audit trail for compliance and governance.',
      stats: `${history.length} ${lang === 'pt' ? 'Registros' : 'Records'}`
    },
    {
      id: 'licenses',
      title: t.reports.types.licenses,
      icon: <ShieldCheck size={24} className="text-indigo-400" />,
      desc: lang === 'pt' ? 'Projeção de vencimentos de licenças e gestão de clientes.' : 'License expiration forecast and client management.',
      stats: users.length > 0 ? `${users.length} ${lang === 'pt' ? 'Clientes' : 'Clients'}` : t.layout.unrestricted
    }
  ];

  const exportCSV = (id: string) => {
    let content = '';
    let fileName = `report_${id}_${new Date().getTime()}.csv`;

    if (id === 'jobs') {
      content = 'ID,Name,Type,Source,Status,Last Run\n' + 
        jobs.map(j => `${j.id},"${j.name}",${j.backupType},"${j.sourcePath}",${j.status},${j.lastRun ? new Date(j.lastRun).toISOString() : 'Never'}`).join('\n');
    } else if (id === 'storage') {
      content = 'ID,Name,Type,Path/Bucket\n' + 
        destinations.map(d => `${d.id},"${d.name}",${d.type},"${d.pathOrBucket}"`).join('\n');
    } else if (id === 'history') {
      content = 'ID,Job,Timestamp,Status,Files,Integrity,Details\n' + 
        history.map(h => `${h.id},"${h.jobName}",${new Date(h.timestamp).toISOString()},${h.status},${h.fileCount},${h.integrity},"${h.details}"`).join('\n');
    } else if (id === 'licenses') {
      content = 'Username,Role,License,Created At,CPF/CNPJ\n' + 
        users.map(u => `"${u.username}",${u.role},${u.licenseType},${new Date(u.createdAt).toISOString()},"${u.cpfCnpj || ''}"`).join('\n');
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    window.print();
  };

  const renderReportTable = () => {
    if (selectedReport === 'jobs') {
      return (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-700">
            <tr><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {jobs.map(j => (
              <tr key={j.id}><td className="p-3 text-white font-medium">{j.name}</td><td className="p-3">{j.backupType}</td><td className="p-3"><span className={j.status === 'SUCCESS' ? 'text-green-400' : 'text-slate-400'}>{j.status}</span></td></tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (selectedReport === 'storage') {
      return (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-700">
            <tr><th className="p-3">Provider</th><th className="p-3">Name</th><th className="p-3">Path</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {destinations.map(d => (
              <tr key={d.id}><td className="p-3 text-blue-400 font-bold">{d.type}</td><td className="p-3 text-white">{d.name}</td><td className="p-3 text-slate-400 font-mono text-xs">{d.pathOrBucket}</td></tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (selectedReport === 'history') {
      return (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-700">
            <tr><th className="p-3">Date</th><th className="p-3">Job</th><th className="p-3">Result</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {history.slice(0, 20).map(h => (
              <tr key={h.id}><td className="p-3 text-slate-400">{new Date(h.timestamp).toLocaleString()}</td><td className="p-3 text-white font-medium">{h.jobName}</td><td className="p-3">{h.status === 'SUCCESS' ? '✅' : '❌'}</td></tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (selectedReport === 'licenses') {
      return (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-700">
            <tr><th className="p-3">User</th><th className="p-3">Type</th><th className="p-3">Tax ID</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map(u => (
              <tr key={u.id}><td className="p-3 text-white font-medium">{u.username}</td><td className="p-3 text-amber-400">{u.licenseType}</td><td className="p-3 text-slate-500">{u.cpfCnpj || '-'}</td></tr>
            ))}
          </tbody>
        </table>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 print:bg-white print:text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 print:hidden">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <FileText className="text-blue-500" size={32} />
            {t.reports.title}
          </h2>
          <p className="text-slate-400 mt-1">{t.reports.description}</p>
        </div>
        <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                {t.reports.lastRun.replace('{date}', now)}
            </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
        {reportCards.map((report) => (
          <div key={report.id} className="group relative bg-slate-900/40 backdrop-blur rounded-2xl border border-slate-700/50 p-6 hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/5">
            <div className="flex items-start justify-between mb-6">
              <div className="p-3 bg-slate-800 rounded-xl group-hover:scale-110 transition-transform">
                {report.icon}
              </div>
              <button 
                onClick={() => exportCSV(report.id)}
                className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-blue-600 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
              >
                <Download size={14} />
                {t.reports.export}
              </button>
            </div>

            <h3 className="text-xl font-bold text-slate-100 mb-2">{report.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 h-10 line-clamp-2">
              {report.desc}
            </p>

            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <span className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                {report.stats}
              </span>
              <button 
                onClick={() => setSelectedReport(report.id)}
                className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest"
              >
                {lang === 'pt' ? 'Visualizar' : 'View report'}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Report Modal / Preview */}
      {selectedReport && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">
                                {reportCards.find(r => r.id === selectedReport)?.title}
                            </h3>
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                                {lang === 'pt' ? 'Pré-visualização do documento' : 'Document Preview'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={printReport}
                            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                            title="Print / Save PDF"
                        >
                            <Printer size={20} />
                        </button>
                        <button 
                            onClick={() => exportCSV(selectedReport)}
                            className="p-2.5 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-xl transition-all"
                            title="Export CSV"
                        >
                            <Download size={20} />
                        </button>
                        <button 
                            onClick={() => setSelectedReport(null)}
                            className="p-2.5 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-xl transition-all ml-4"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-950/30">
                    <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6 overflow-hidden">
                        {renderReportTable()}
                    </div>
                    
                    <div className="mt-8 flex justify-center text-slate-600 text-[10px] uppercase font-bold tracking-[0.2em]">
                        CloudGuard Backup Solution - Enterprise Reporting Module
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-500/20 rounded-2xl p-8 mt-8 print:hidden">
        <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="shrink-0 w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/30">
                <FileText className="text-blue-400" size={36} />
            </div>
            <div className="flex-1 text-center md:text-left">
                <h4 className="text-lg font-bold text-white mb-2">Relatórios Personalizados (Enterprise)</h4>
                <p className="text-slate-400 text-sm">
                    Precisa de uma visão específica para sua empresa? Nossa IA pode consolidar dados de múltiplos usuários raiz em um único dashboard executivo.
                </p>
            </div>
            <button className="bg-white text-slate-900 font-black px-8 py-3 rounded-xl hover:bg-blue-50 transition-all shrink-0">
                Falar com Suporte
            </button>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
