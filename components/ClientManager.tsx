import React, { useState, useEffect, useMemo } from 'react';
import { User, Language, LicenseType, UserRole } from '../types';
import { AuthService } from '../services/storageService';
import { Bell, ShieldAlert, CheckCircle, Clock, Trash2, Plus, X, RefreshCw, Users, ShieldCheck, AlertTriangle, RotateCcw, Search, CreditCard, Edit2 } from 'lucide-react';
import { useTranslation } from '../utils/translations';
import { MaskService } from '../utils/masks';

interface ClientManagerProps {
  lang: Language;
}

const ClientManager: React.FC<ClientManagerProps> = ({ lang }) => {
  const t = useTranslation(lang);
  const [users, setUsers] = useState<User[]>([]);
  const [editingConfigUser, setEditingConfigUser] = useState<User | null>(null);
  const [thresholdInput, setThresholdInput] = useState<number>(15);
  const [searchTerm, setSearchTerm] = useState('');

  // New Client Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCpfCnpj, setNewClientCpfCnpj] = useState('');
  const [newClientDuration, setNewClientDuration] = useState(30);

  // Edit Client Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editCpfCnpj, setEditCpfCnpj] = useState('');

  // Renew Modal State
  const [renewUser, setRenewUser] = useState<User | null>(null);
  const [renewDuration, setRenewDuration] = useState(365);

  // Delete & Undo state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [undoUser, setUndoUser] = useState<User | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    // Only fetch non-root users
    const allUsers = AuthService.getAllUsers();
    setUsers(allUsers.filter(u => u.role !== UserRole.ROOT));
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.cpfCnpj && u.cpfCnpj.includes(searchTerm)) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [users, searchTerm]);

  const getStatus = (user: User) => {
    if (user.licenseType === LicenseType.EXPIRED) return 'expired';

    // Calculate days remaining
    let daysRemaining = 0;
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (user.licenseType === LicenseType.TRIAL) {
      daysRemaining = 15 - Math.floor((Date.now() - user.createdAt) / ONE_DAY);
    } else {
      // Use stored duration or default 365
      const activation = user.licenseActivatedAt || user.createdAt;
      const duration = user.licenseDuration || 365;
      daysRemaining = duration - Math.floor((Date.now() - activation) / ONE_DAY);
    }

    const threshold = user.notificationThresholdDays || 15;

    if (daysRemaining <= 0) return 'expired';
    if (daysRemaining <= threshold) return 'warning';
    return 'active';
  };

  const getExpiryDate = (user: User) => {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const start = (user.licenseType === LicenseType.PRO ? user.licenseActivatedAt : user.createdAt) || Date.now();
    const duration = user.licenseType === LicenseType.PRO ? (user.licenseDuration || 365) : 15;
    const expiry = new Date(start + (duration * ONE_DAY));
    return expiry.toLocaleDateString();
  };

  const openConfigEdit = (user: User) => {
    setEditingConfigUser(user);
    setThresholdInput(user.notificationThresholdDays || 15);
  };

  const openClientEdit = (user: User) => {
    setClientToEdit(user);
    setEditName(user.username);
    setEditCpfCnpj(user.cpfCnpj || '');
    setShowEditModal(true);
  };

  const triggerDelete = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      setUndoUser(userToDelete);
      AuthService.deleteUser(userToDelete.id);
      loadUsers();
      setShowDeleteModal(false);
      setUserToDelete(null);

      // Clear undo after 10 seconds
      setTimeout(() => setUndoUser(null), 10000);
    }
  };

  const restoreUser = () => {
    if (undoUser) {
      AuthService.restoreUser(undoUser);
      loadUsers();
      setUndoUser(null);
    }
  };

  const saveConfig = () => {
    if (editingConfigUser) {
      AuthService.updateUserConfig(editingConfigUser.id, { notificationThresholdDays: thresholdInput });
      loadUsers();
      setEditingConfigUser(null);
    }
  };

  const saveClientEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clientToEdit) {
      AuthService.updateUserConfig(clientToEdit.id, { 
        username: editName,
        cpfCnpj: editCpfCnpj
      });
      loadUsers();
      setShowEditModal(false);
      setClientToEdit(null);
    }
  };

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      AuthService.createClientWithLicense(newClientName, newClientDuration, newClientCpfCnpj);
      setShowAddModal(false);
      setNewClientName('');
      setNewClientCpfCnpj('');
      loadUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRenew = () => {
    if (renewUser) {
      AuthService.renewUserLicense(renewUser.id, renewDuration);
      setRenewUser(null);
      loadUsers();
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Undo Toast */}
      {undoUser && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right duration-300">
          <div className="bg-slate-900 border border-blue-500/30 rounded-lg p-4 shadow-2xl flex items-center gap-4">
            <div className="text-blue-400">
               <RotateCcw className="animate-spin-slow" size={20} />
            </div>
            <div>
              <p className="text-white text-sm font-medium">{t.settings.userDeleted}</p>
              <p className="text-slate-400 text-xs font-mono">{undoUser.username}</p>
            </div>
            <button 
              onClick={restoreUser}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
            >
              {t.settings.undo}
            </button>
            <button onClick={() => setUndoUser(null)} className="text-slate-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users size={24} className="text-blue-400"/>
            {t.clients.title}
        </h2>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
             <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
             <input 
               type="text"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               placeholder={t.clients.searchPlaceholder}
               className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 shadow-inner"
             />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 transition-all hover:shadow-lg hover:shadow-blue-900/40 active:scale-95 whitespace-nowrap"
          >
            <Plus size={18} />
            <span className="font-bold">{t.clients.addClient}</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-900/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
              <tr>
                <th className="p-4">{t.clients.user}</th>
                <th className="p-4">{t.auth.cpfCnpj}</th>
                <th className="p-4">{t.clients.status}</th>
                <th className="p-4">{t.clients.license}</th>
                <th className="p-4">{t.clients.activated}</th>
                <th className="p-4">{t.clients.expires}</th>
                <th className="p-4">{t.clients.notify}</th>
                <th className="p-4 text-right px-8">{t.clients.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredUsers.map(user => {
                const status = getStatus(user);
                return (
                  <tr key={user.id} className="hover:bg-slate-700/30 transition-colors group">
                    <td className="p-4 font-bold text-white group-hover:text-blue-300 transition-colors">
                      <div className="flex flex-col">
                        <span>{user.username}</span>
                        {user.email && <span className="text-[10px] text-slate-500 font-normal">{user.email}</span>}
                      </div>
                    </td>
                    <td className="p-4 text-xs font-mono text-slate-400 group-hover:text-slate-100 transition-colors">{user.cpfCnpj || '-'}</td>
                    <td className="p-4">
                      {status === 'active' && <span className="flex items-center gap-1.5 text-green-400 bg-green-900/20 px-2.5 py-1 rounded text-[9px] font-black border border-green-800/30 uppercase tracking-wider"><ShieldCheck size={12} /> {t.clients.statusActive}</span>}
                      {status === 'warning' && <span className="flex items-center gap-1.5 text-yellow-500 bg-yellow-900/20 px-2.5 py-1 rounded text-[9px] font-black border border-yellow-700/30 uppercase tracking-wider"><Clock size={12} /> {t.clients.statusWarning}</span>}
                      {status === 'expired' && <span className="flex items-center gap-1.5 text-red-500 bg-red-900/20 px-2.5 py-1 rounded text-[9px] font-black border border-red-700/30 uppercase tracking-wider"><ShieldAlert size={12} /> {t.clients.statusExpired}</span>}
                    </td>
                    <td className="p-4 font-mono text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">
                      {user.licenseType === LicenseType.TRIAL ? 
                        <span className="text-indigo-400 px-2.5 py-0.5 bg-indigo-900/20 border border-indigo-700/30 rounded-full font-bold uppercase tracking-tighter">{t.clients.trial}</span> 
                        : user.licenseKey}
                    </td>
                    <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                      {new Date(user.licenseActivatedAt || user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                      {getExpiryDate(user)}
                    </td>
                    <td className="p-4 text-sm text-slate-400 whitespace-nowrap">
                      {user.notificationThresholdDays || 15} {t.clients.days}
                    </td>
                    <td className="p-4 text-right px-6 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openClientEdit(user)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all" title={t.clients.editClient}>
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => setRenewUser(user)} className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-all" title={t.clients.renew}>
                            <RefreshCw size={16} />
                          </button>
                          <button onClick={() => openConfigEdit(user)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all" title={t.clients.configNotify}>
                            <Bell size={16} />
                          </button>
                          <button onClick={() => triggerDelete(user)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" title={t.jobs.delete}>
                            <Trash2 size={16} />
                          </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-slate-500 italic font-medium">
                    {searchTerm ? "No clients found matching your search." : "No clients registered yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-8 shadow-2xl relative animate-modal-pop">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                    <Plus size={20} />
                  </div>
                  {t.clients.createClient}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </div>

            <form onSubmit={handleAddClient} className="space-y-5">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-black mb-2 tracking-widest">{t.clients.username}</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                  placeholder="client_name"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-black mb-2 tracking-widest">{t.auth.cpfCnpj}</label>
                <div className="relative">
                  <CreditCard size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="text"
                    required
                    value={newClientCpfCnpj}
                    onChange={e => setNewClientCpfCnpj(MaskService.maskCpfCnpj(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pl-10 text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-black mb-2 tracking-widest">{t.clients.duration}</label>
                <select
                  value={newClientDuration}
                  onChange={e => setNewClientDuration(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all app-select font-bold"
                >
                  <option value={10}>10 {t.admin.days}</option>
                  <option value={15}>15 {t.admin.days}</option>
                  <option value={30}>30 {t.admin.days}</option>
                  <option value={60}>60 {t.admin.days}</option>
                  <option value={180}>180 {t.admin.days}</option>
                  <option value={365}>365 {t.admin.days}</option>
                </select>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-[11px] text-blue-400/80 flex items-center gap-3 italic">
                <ShieldAlert size={20} className="shrink-0 text-blue-500" />
                {t.auth.defaultPassMsg.replace('{ANO}', new Date().getFullYear().toString())}
              </div>

              <div className="pt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-all font-bold uppercase text-[10px] tracking-widest">{t.destinations.cancel}</button>
                <button type="submit" className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-black shadow-lg shadow-blue-900/40 transition-all active:scale-95 uppercase text-[11px] tracking-widest">{t.clients.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditModal && clientToEdit && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-8 shadow-2xl relative animate-modal-pop">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                    <Edit2 size={20} />
                  </div>
                  {t.clients.editClient}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </div>

            <form onSubmit={saveClientEdit} className="space-y-5">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-black mb-2 tracking-widest">{t.clients.username}</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-black mb-2 tracking-widest">{t.auth.cpfCnpj}</label>
                <div className="relative">
                  <CreditCard size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    type="text"
                    required
                    value={editCpfCnpj}
                    onChange={e => setEditCpfCnpj(MaskService.maskCpfCnpj(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pl-10 text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-all font-bold uppercase text-[10px] tracking-widest">{t.destinations.cancel}</button>
                <button type="submit" className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-black shadow-lg shadow-blue-900/40 transition-all active:scale-95 uppercase text-[11px] tracking-widest">{t.clients.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Config Modal */}
      {editingConfigUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-8 shadow-2xl relative animate-modal-pop">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
                   <Bell size={20} />
                </div>
                {t.clients.configNotify}
            </h3>
            <p className="text-sm text-slate-500 mb-6">{t.clients.user}: <span className="text-white font-bold font-mono">{editingConfigUser.username}</span></p>

            <label className="block text-slate-400 text-[10px] uppercase font-black mb-2 tracking-widest">{t.clients.days}</label>
            <input
              type="number"
              min="1"
              max="60"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(parseInt(MaskService.onlyDigits(e.target.value)) || 0)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 mb-8 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-black text-center text-2xl shadow-inner"
            />

            <div className="flex justify-end gap-2 pt-6 border-t border-slate-800">
              <button onClick={() => setEditingConfigUser(null)} className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-all font-bold uppercase text-[10px] tracking-widest">{t.destinations.cancel}</button>
              <button onClick={saveConfig} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-black shadow-lg shadow-indigo-900/40 transition-all active:scale-95 uppercase text-[11px] tracking-widest">{t.clients.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Renew License Modal */}
      {renewUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-green-500/30 rounded-2xl max-w-sm w-full p-8 shadow-2xl relative animate-modal-pop">
            <h3 className="text-xl font-bold mb-2 text-green-400 flex items-center gap-3">
                <div className="p-2 bg-green-600/20 rounded-lg text-green-400">
                    <RefreshCw size={20} />
                </div>
                {t.clients.renew}
            </h3>
            <p className="text-sm text-slate-500 mb-6">{t.clients.user}: <span className="text-white font-bold font-mono">{renewUser.username}</span></p>

            <label className="block text-slate-400 text-[10px] uppercase font-black mb-2 tracking-widest">{t.admin.duration}</label>
            <select
              value={renewDuration}
              onChange={(e) => setRenewDuration(parseInt(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 mb-8 text-white outline-none focus:ring-2 focus:ring-green-500/50 transition-all font-bold app-select"
            >
              <option value={10}>10 {t.admin.days}</option>
              <option value={15}>15 {t.admin.days}</option>
              <option value={30}>30 {t.admin.days}</option>
              <option value={60}>60 {t.admin.days}</option>
              <option value={180}>180 {t.admin.days}</option>
              <option value={365}>365 {t.admin.days}</option>
            </select>

            <div className="flex justify-end gap-2 pt-6 border-t border-slate-800">
              <button onClick={() => setRenewUser(null)} className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-all font-bold uppercase text-[10px] tracking-widest">{t.destinations.cancel}</button>
              <button onClick={handleRenew} className="px-8 py-2.5 bg-green-600 hover:bg-green-500 rounded-xl text-white font-black shadow-lg shadow-green-900/40 transition-all active:scale-95 uppercase text-[11px] tracking-widest">{t.clients.renew}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-sm w-full p-8 shadow-2xl text-center animate-modal-pop">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 font-black scale-up">
               <AlertTriangle size={36} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{t.jobs.delete}</h3>
            <p className="text-slate-400 text-sm mb-10 leading-relaxed">
              {t.clients.deleteConfirm}
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={confirmDelete}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-red-900/40 active:scale-[0.98] uppercase text-xs tracking-widest"
              >
                {t.jobs.delete}
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-3.5 text-slate-500 hover:text-white font-bold uppercase text-[10px] tracking-widest transition-colors"
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

export default ClientManager;