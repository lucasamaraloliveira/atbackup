
import React, { useMemo } from 'react';
import { BackupJob, Destination, Language } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, CheckCircle, AlertTriangle, HardDrive } from 'lucide-react';
import { useTranslation } from '../utils/translations';

interface DashboardProps {
  jobs: BackupJob[];
  destinations: Destination[];
  lang: Language;
}

const Dashboard: React.FC<DashboardProps> = ({ jobs, destinations, lang }) => {
  const t = useTranslation(lang);
  
  const stats = useMemo(() => {
    return {
      totalJobs: jobs.length,
      success: jobs.filter(j => j.status === 'SUCCESS').length,
      failed: jobs.filter(j => j.status === 'ERROR').length,
      destinations: destinations.length
    };
  }, [jobs, destinations]);

  const data = [
    { name: t.dashboard.success, value: stats.success, color: '#22c55e' },
    { name: t.dashboard.failed, value: stats.failed, color: '#ef4444' },
    { name: t.dashboard.idle, value: stats.totalJobs - stats.success - stats.failed, color: '#64748b' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-8">{t.dashboard.title}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t.dashboard.totalJobs} value={stats.totalJobs} icon={<Activity />} color="bg-blue-600" />
        <StatCard title={t.dashboard.successRuns} value={stats.success} icon={<CheckCircle />} color="bg-green-600" />
        <StatCard title={t.dashboard.failedRuns} value={stats.failed} icon={<AlertTriangle />} color="bg-red-600" />
        <StatCard title={t.dashboard.destinations} value={stats.destinations} icon={<HardDrive />} color="bg-indigo-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-6">{t.dashboard.jobHealth}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                  itemStyle={{ color: '#f8fafc' }}
                  cursor={{fill: 'transparent'}}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-4">{t.dashboard.recentActivity}</h3>
          <div className="space-y-4">
            {jobs.slice(0, 5).map(job => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    job.status === 'SUCCESS' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
                    job.status === 'ERROR' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-slate-500'
                  }`} />
                  <span className="font-medium">{job.name}</span>
                </div>
                <span className="text-sm text-slate-400">
                  {job.lastRun ? new Date(job.lastRun).toLocaleDateString() : t.dashboard.never}
                </span>
              </div>
            ))}
            {jobs.length === 0 && <p className="text-slate-500 text-center py-8">{t.dashboard.noJobs}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const StatCard = ({ title, value, icon, color }: StatCardProps) => (
  <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6 rounded-xl flex items-center justify-between hover:border-slate-600 transition-colors">
    <div>
      <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
    <div className={`p-3 rounded-lg ${color} bg-opacity-20 text-white shadow-lg shadow-${color}/10`}>
      {icon}
    </div>
  </div>
);

export default Dashboard;
