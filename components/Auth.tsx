
import React, { useState } from 'react';
import { User, Language } from '../types';
import { AuthService } from '../services/storageService';
import { ShieldCheck, Globe, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useTranslation } from '../utils/translations';
import { MaskService } from '../utils/masks';

interface AuthProps {
  onLogin: (user: User) => void;
  lang: Language;
  setLang: (l: Language) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, lang, setLang }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  
  const t = useTranslation(lang);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isLogin) {
        const user = AuthService.login(username, password);
        if (user) {
          onLogin(user);
        } else {
          setError(t.auth.userNotFound + " / " + "Invalid Credentials");
        }
      } else {
        AuthService.register(username, password, email, cpfCnpj);
        setShowSuccess(true);
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message === 'User already exists') {
         setError(t.auth.userExists);
      } else if (error.message === 'Invalid credentials') {
         setError('Usuário ou senha inválidos');
      } else {
         setError(error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-green-500/30 rounded-2xl max-w-sm w-full p-8 shadow-[0_0_40px_rgba(34,197,94,0.15)] text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-green-500/10 rounded-full">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t.auth.successTitle}</h2>
            <p className="text-slate-400 mb-8">{t.auth.successMessage}</p>
            <button 
              onClick={() => {
                setShowSuccess(false);
                setIsLogin(true);
                setPassword('');
              }}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-green-900/40"
            >
              OK / {t.auth.login}
            </button>
          </div>
        </div>
      )}

      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/10 z-10">
        <div className="p-8 text-center border-b border-white/5 bg-slate-900/50">
           <div className="absolute top-4 right-4">
              <button 
                 onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
                 className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded-full border border-slate-700"
              >
                  <Globe size={12} />
                  {lang.toUpperCase()}
              </button>
           </div>
           <div className="flex justify-center mb-4">
             <div className="p-3 bg-blue-600/20 rounded-full border border-blue-500/20 shadow-[0_0_15px_rgba(37,99,235,0.3)]">
               <ShieldCheck className="w-10 h-10 text-blue-500" />
             </div>
           </div>
           <h1 className="text-2xl font-bold text-white mb-2">{t.auth.title}</h1>
           <p className="text-slate-400">{t.auth.subtitle}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/30 rounded text-red-200 text-sm flex items-center justify-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">{t.auth.username}</label>
                <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                placeholder={t.auth.usernamePlaceholder}
                required
                />
            </div>
            
            {!isLogin && (
              <>
                <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">{t.auth.email}</label>
                    <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                    required
                    />
                </div>
                <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">{t.auth.cpfCnpj}</label>
                    <input 
                    type="text" 
                    value={cpfCnpj}
                    onChange={e => setCpfCnpj(MaskService.maskCpfCnpj(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                    placeholder={t.auth.cpfCnpjPlaceholder}
                    required
                    />
                </div>
              </>
            )}
            
            <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">{t.auth.password}</label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 pr-10 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                    placeholder={t.auth.passwordPlaceholder}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-blue-900/40 hover:shadow-blue-600/20 hover:translate-y-[-1px]"
          >
            {isLogin ? t.auth.signIn : t.auth.createAccount}
          </button>

          <div className="text-center text-sm text-slate-400">
            {isLogin ? t.auth.noAccount : t.auth.hasAccount}{" "}
            <button 
              type="button" 
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
            >
              {isLogin ? t.auth.registerTrial : t.auth.login}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Auth;
