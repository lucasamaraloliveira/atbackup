import React, { useState, useEffect } from 'react';
import { User, UserRole, Language } from '../types';
import { AuthService } from '../services/storageService';
import { Shield, Plus, Trash2, Edit, X, AlertTriangle, RotateCcw, AlertCircle } from 'lucide-react';
import { useTranslation } from '../utils/translations';

interface PermissionsPanelProps {
  user: User;
  lang: Language;
}

const MENUS = [
  { id: 'dashboard', labelEn: 'Dashboard', labelPt: 'Visão Geral' },
  { id: 'jobs', labelEn: 'Backup Jobs', labelPt: 'Tarefas de Backup' },
  { id: 'destinations', labelEn: 'Destinations', labelPt: 'Destinos' },
  { id: 'history', labelEn: 'History', labelPt: 'Histórico' },
  { id: 'settings', labelEn: 'Settings', labelPt: 'Configurações' }
];

export const PermissionsPanel: React.FC<PermissionsPanelProps> = ({ user, lang }) => {
  const t = useTranslation(lang);
  const [subUsers, setSubUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedMenus, setSelectedMenus] = useState<string[]>(['dashboard', 'history']);
  const [error, setError] = useState('');

  // Delete & Undo state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [undoUser, setUndoUser] = useState<User | null>(null);

  useEffect(() => {
    loadSubUsers();
  }, []);

  const loadSubUsers = () => {
    setSubUsers(AuthService.getSubUsers(user.id));
  };

  const toggleMenu = (menuId: string) => {
    setSelectedMenus(prev => 
      prev.includes(menuId) ? prev.filter(m => m !== menuId) : [...prev, menuId]
    );
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setSelectedMenus(['dashboard', 'history']);
    setError('');
    setEditingUser(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (su: User) => {
    setEditingUser(su);
    setUsername(su.username);
    setPassword(''); // Don't show old password
    setSelectedMenus(su.allowedMenus || []);
    setError('');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingUser) {
        // EDIT MODE
        AuthService.updateSubUser(editingUser.id, selectedMenus, password || undefined);
      } else {
        // ADD MODE
        if (subUsers.length >= 2) throw new Error(t.settings.maxChildren);
        AuthService.createSubUser(user.id, username, password, selectedMenus);
      }
      
      setShowModal(false);
      resetForm();
      loadSubUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const triggerDelete = (su: User) => {
    setUserToDelete(su);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      setUndoUser(userToDelete);
      AuthService.deleteUser(userToDelete.id);
      loadSubUsers();
      setShowDeleteModal(false);
      setUserToDelete(null);

      // Clear undo after 10 seconds
      setTimeout(() => setUndoUser(null), 10000);
    }
  };

  const restoreUser = () => {
    if (undoUser) {
      AuthService.restoreUser(undoUser);
      loadSubUsers();
      setUndoUser(null);
    }
  };

  const isLimitReached = subUsers.length >= 2 && !editingUser;

  return (
    <div className="space-y-6 relative">
      {/* Undo Toast */}
      {undoUser && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right duration-300">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-lg p-4 shadow-2xl flex items-center gap-4">
            <div className="text-indigo-400">
               <RotateCcw className="animate-spin-slow" size={20} />
            </div>
            <div>
              <p className="text-white text-sm font-medium">{t.settings.userDeleted}</p>
              <p className="text-slate-400 text-xs font-mono">{undoUser.username}</p>
            </div>
            <button 
              onClick={restoreUser}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
            >
              {t.settings.undo}
            </button>
            <button onClick={() => setUndoUser(null)} className="text-slate-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-end mb-4">
          <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-100">
                  <Shield size={24} className="text-indigo-400"/>
                  {t.settings.permissionsTab}
              </h2>
          </div>
          {!isLimitReached && (
            <button
              onClick={handleOpenAdd}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> {t.settings.addSubAccount}
            </button>
          )}
      </div>

      {subUsers.length >= 2 && (
          <div className="bg-amber-900/10 border border-amber-500/20 text-amber-500 text-xs p-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={14} />
              {t.settings.maxChildren}
          </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
          <table className="w-full text-left">
          <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
              <th className="p-4 font-semibold">{t.auth.username}</th>
              <th className="p-4 font-semibold">{t.settings.menus}</th>
              <th className="p-4 font-semibold">{t.admin.created}</th>
              <th className="p-4 font-semibold text-right px-8">{t.admin.actions}</th>
              </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
              {subUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500 italic">
                     Nenhum usuário filho vinculado.
                  </td>
                </tr>
              ) : subUsers.map(su => (
              <tr key={su.id} className="hover:bg-slate-700/30 transition-colors group">
                  <td className="p-4 font-bold text-white font-mono">{su.username}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {su.allowedMenus?.map(m => (
                        <span key={m} className="px-2 py-0.5 bg-slate-900 text-slate-400 text-[10px] uppercase font-bold border border-slate-700 rounded transition-colors group-hover:border-indigo-500/30 group-hover:text-indigo-300">
                           {MENUS.find(menu => menu.id === m)?.[lang === 'pt' ? 'labelPt' : 'labelEn'] || m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-500">{new Date(su.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-right px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEdit(su)} 
                          className="text-slate-400 hover:text-indigo-400 p-2 hover:bg-indigo-400/10 rounded-lg transition-all"
                          title={t.settings.editPermissions}
                        >
                          <Edit size={16}/>
                        </button>
                        <button 
                          onClick={() => triggerDelete(su)} 
                          className="text-slate-400 hover:text-red-400 p-2 hover:bg-red-400/10 rounded-lg transition-all"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                  </td>
              </tr>
              ))}
          </tbody>
          </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
       <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
         <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-8 shadow-2xl relative animate-modal-pop">
           <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
              <X size={20} />
           </button>

           <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
             <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
               {editingUser ? <Edit size={20} /> : <Plus size={20} />}
             </div>
             {editingUser ? t.settings.editPermissions : t.settings.addSubAccount}
           </h3>

           <form onSubmit={handleSave} className="space-y-5">
             {error && <div className="p-3 bg-red-900/20 text-red-300 border border-red-500/30 rounded-lg text-sm">{error}</div>}
             
             <div>
               <label className="block text-slate-400 text-xs uppercase font-bold mb-2 tracking-wider">{t.auth.username}</label>
               <input 
                 disabled={!!editingUser}
                 required 
                 value={username} 
                 onChange={e => setUsername(e.target.value)} 
                 className={`w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${editingUser ? 'opacity-50 cursor-not-allowed' : ''}`} 
               />
             </div>

             <div>
               <label className="block text-slate-400 text-xs uppercase font-bold mb-2 tracking-wider">
                 {t.auth.password} {editingUser && <span className="text-slate-600 text-[10px] normal-case font-normal">(Leave empty to keep current)</span>}
               </label>
               <input 
                 required={!editingUser} 
                 type="password" 
                 value={password} 
                 onChange={e => setPassword(e.target.value)} 
                 className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" 
                 placeholder={editingUser ? '••••••••' : ''}
               />
             </div>
             
             <div>
               <label className="block text-slate-400 text-xs uppercase font-bold mb-3 tracking-wider">{t.settings.menus}</label>
               <div className="grid grid-cols-2 gap-2">
                 {MENUS.map(m => (
                   <button 
                     key={m.id}
                     type="button"
                     onClick={() => toggleMenu(m.id)}
                     className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm transition-all ${
                       selectedMenus.includes(m.id) 
                         ? 'bg-indigo-600/10 border-indigo-600 text-indigo-300 shadow-[0_0_15px_rgba(79,70,229,0.1)]' 
                         : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                     }`}
                   >
                     <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        selectedMenus.includes(m.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-700 bg-slate-900 shadow-inner'
                     }`}>
                        {selectedMenus.includes(m.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                     </div>
                     {lang === 'pt' ? m.labelPt : m.labelEn}
                   </button>
                 ))}
               </div>
             </div>

             <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-800">
               <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-sm font-medium">
                 {t.destinations.cancel}
               </button>
               <button type="submit" className="px-8 py-2.5 rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 font-bold shadow-lg shadow-indigo-900/40 transition-all active:scale-95">
                 {t.clients.save}
               </button>
             </div>
           </form>
         </div>
       </div>
     )}

     {/* Delete Confirmation Modal */}
     {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-sm w-full p-8 shadow-2xl text-center animate-modal-pop">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6">
               <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{t.jobs.delete}</h3>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              {t.settings.confirmDeleteUser}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDelete}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-900/40"
              >
                {t.jobs.delete}
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-3 text-slate-400 hover:text-white font-medium transition-colors"
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
