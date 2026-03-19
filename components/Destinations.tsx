
import React, { useState } from 'react';
import { Destination, DestinationType, Language } from '../types';
import { Plus, Trash2, Cloud, Search, Edit, HardDrive, Server, Network, Download, X, Lock, ChevronDown, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from '../utils/translations';
// FileBrowser remove

interface DestinationsProps {
  destinations: Destination[];
  onAdd: (d: Destination) => void;
  onDelete: (id: string) => void;
  lang: Language;
}

const WASABI_REGIONS = [
  { id: 'us-east-1', name: 'US East 1 (N. Virginia)', endpoint: 's3.us-east-1.wasabisys.com' },
  { id: 'us-east-2', name: 'US East 2 (N. Virginia)', endpoint: 's3.us-east-2.wasabisys.com' },
  { id: 'us-central-1', name: 'US Central 1 (Texas)', endpoint: 's3.us-central-1.wasabisys.com' },
  { id: 'us-west-1', name: 'US West 1 (Oregon)', endpoint: 's3.us-west-1.wasabisys.com' },
  { id: 'eu-central-1', name: 'EU Central 1 (Amsterdam)', endpoint: 's3.eu-central-1.wasabisys.com' },
  { id: 'eu-central-2', name: 'EU Central 2 (Frankfurt)', endpoint: 's3.eu-central-2.wasabisys.com' },
  { id: 'eu-west-1', name: 'EU West 1 (London)', endpoint: 's3.eu-west-1.wasabisys.com' },
  { id: 'eu-west-2', name: 'EU West 2 (Paris)', endpoint: 's3.eu-west-2.wasabisys.com' },
  { id: 'ap-northeast-1', name: 'AP Northeast 1 (Tokyo)', endpoint: 's3.ap-northeast-1.wasabisys.com' },
  { id: 'ap-northeast-2', name: 'AP Northeast 2 (Osaka)', endpoint: 's3.ap-northeast-2.wasabisys.com' },
  { id: 'ap-southeast-1', name: 'AP Southeast 1 (Singapore)', endpoint: 's3.ap-southeast-1.wasabisys.com' },
  { id: 'ap-southeast-2', name: 'AP Southeast 2 (Sydney)', endpoint: 's3.ap-southeast-2.wasabisys.com' },
  { id: 'ca-central-1', name: 'CA Central 1 (Toronto)', endpoint: 's3.ca-central-1.wasabisys.com' },
];

const Destinations: React.FC<DestinationsProps> = ({ destinations, onAdd, onDelete, lang }) => {
  const t = useTranslation(lang);
  const [isAdding, setIsAdding] = useState(false);
  // Browser state removed

  // Mount Modal State
  const [mountModalDest, setMountModalDest] = useState<Destination | null>(null);
  const [showProviderSelect, setShowProviderSelect] = useState(false);

  // Testing Connectivity State
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; id?: string } | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  // Drive Selection for Mount
  const [selectedLetter, setSelectedLetter] = useState('M');
  const DRIVE_LETTERS = ['G', 'M', 'S', 'T', 'W', 'X', 'Y', 'Z'];

  // State for the form
  const [newDest, setNewDest] = useState<Partial<Destination>>({
    type: DestinationType.AWS,
    name: '',
    pathOrBucket: '',
    credentials: {}
  });

  const getProviderName = (type: DestinationType) => {
    const p = t.destinations.providers;
    switch (type) {
      case DestinationType.LOCAL: return p.local;
      case DestinationType.FTP: return p.ftp;
      case DestinationType.AWS: return p.aws;
      case DestinationType.AZURE: return p.azure;
      case DestinationType.GOOGLE: return p.google;
      case DestinationType.GOOGLE_DRIVE: return p.googleDrive;
      case DestinationType.WASABI: return p.wasabi;
      case DestinationType.BACKBLAZE: return p.backblaze;
      case DestinationType.DROPBOX: return p.dropbox;
      case DestinationType.DIGITALOCEAN: return p.digitalocean;
      case DestinationType.NETWORK: return p.network;
      default: return type;
    }
  };

  const resetForm = () => {
    setNewDest({
      type: DestinationType.AWS,
      name: '',
      pathOrBucket: '',
      credentials: {}
    });
    setIsAdding(false);
  };

  const handleEdit = (dest: Destination) => {
    setNewDest({ ...dest });
    setIsAdding(true);
  };

  const handleSave = () => {
    if (newDest.name && newDest.type) {
      onAdd({
        id: newDest.id || crypto.randomUUID(), // Keep ID if editing, else generate
        name: newDest.name,
        type: newDest.type as DestinationType,
        pathOrBucket: newDest.pathOrBucket || '',
        credentials: newDest.credentials || {}
      });
      resetForm();
    }
  };

  const handlePathSelect = (path: string) => {
    setNewDest(prev => ({ ...prev, pathOrBucket: path }));
  };

  const handleTest = async (destToTest: Partial<Destination>) => {
    setTestingId(destToTest.id || 'new');
    setTestResult(null);

    try {
      const response = await fetch('/api/destinations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(destToTest)
      });
      const data = await response.json();
      setTestResult({ ...data, id: destToTest.id || 'new' });
    } catch (error) {
      setTestResult({ success: false, message: 'Erro de comunicação com o servidor', id: destToTest.id || 'new' });
    } finally {
      setTestingId(null);
    }
  };

  const handleNativeBrowse = async () => {
    try {
      const response = await fetch('/api/browse?type=directory');
      const data = await response.json();
      if (data.path) {
        handlePathSelect(data.path);
      }
    } catch (error) {
      console.error('Failed to open native browser', error);
    }
  };

  const handleSetupRclone = async () => {
    setIsInstalling(true);
    try {
        const response = await fetch('/api/setup/rclone', { method: 'POST' });
        const data = await response.json();
        alert(data.message || 'Setup concluído!');
    } catch (error) {
        alert('Erro ao rodar setup automágico.');
    } finally {
        setIsInstalling(false);
    }
  };

  const handleDownloadAgent = () => {
    window.location.href = '/api/agent/download';
  };

  const handleDownloadOneClickScript = async (dest: Destination, letter: string) => {
    try {
        const response = await fetch('/api/agent/generate-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dest, letter })
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ativar_Disco_${dest.name.replace(/\s+/g, '_')}_${letter}.bat`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Falha ao baixar script automatizado', error);
    }
  };

  const handleCopyMountCommand = (dest: Destination) => {
    let command = '';
    const creds = dest.credentials || {};
    
    if (dest.type === DestinationType.NETWORK) {
        // net use [Drive] [Path] [Password] /user:[User] /persistent:yes
        command = `taskkill /F /IM CloudGuardAgent_Setup.exe /IM rclone.exe /T 2>$null; net use M: /delete /y 2>$null; net use M: "${dest.pathOrBucket}" ${creds.password || 'PASSWORD'} /user:${creds.user || 'USER'} /persistent:yes`;
    } else {
        // Cloud via rclone flags (most reliable)
        const bucket = dest.pathOrBucket;
        let provider = 'AWS';
        if (dest.type === DestinationType.WASABI) provider = 'Wasabi';
        if (dest.type === DestinationType.DIGITALOCEAN) provider = 'DigitalOcean';
        if (dest.type === DestinationType.BACKBLAZE) provider = 'Backblaze';
        if (dest.type === DestinationType.GOOGLE) provider = 'GoogleCloudStorage';
        
        const endpoint = creds.endpoint || (dest.type === DestinationType.WASABI ? 's3.wasabisys.com' : '');
        const region = creds.region || 'us-east-1';

        command = `taskkill /F /IM CloudGuardAgent_Setup.exe /IM rclone.exe /T 2>$null; net use M: /delete /y 2>$null; .\\CloudGuardAgent_Setup.exe mount :s3:${bucket} M: --s3-provider ${provider} --s3-access-key-id ${creds.accessKeyId || ''} --s3-secret-access-key ${creds.secretAccessKey || ''} --s3-region ${region} --s3-endpoint ${endpoint} --vfs-cache-mode full --dir-cache-time 20s --volname "CloudGuard Cloud"`;
    }
    
    navigator.clipboard.writeText(command);
    alert('Comando TOTALMENTE configurado e copiado! Basta colar no terminal (Admin) e apertar Enter.');
  };

  const updateCredential = (key: string, value: string) => {
    setNewDest(prev => {
      const updatedCreds = {
        ...(prev.credentials || {}),
        [key]: value
      };

      // Auto-fill endpoint for Wasabi based on region
      if (prev.type === DestinationType.WASABI && key === 'region') {
          const region = WASABI_REGIONS.find(r => r.id === value);
          if (region) {
              updatedCreds.endpoint = region.endpoint;
          }
      }

      return {
        ...prev,
        credentials: updatedCreds
      };
    });
  };

  // Helper to render dynamic fields based on DestinationType
  const renderSpecificFields = () => {
    switch (newDest.type) {
      case DestinationType.WASABI:
      case DestinationType.AWS:
      case DestinationType.DIGITALOCEAN:
      case DestinationType.BACKBLAZE:
      case DestinationType.GOOGLE:
        return (
          <>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.bucketPath}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                placeholder="my-backup-bucket"
                value={newDest.pathOrBucket}
                onChange={e => setNewDest({ ...newDest, pathOrBucket: e.target.value })}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.accessKey}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                value={newDest.credentials?.accessKeyId || ''}
                onChange={e => updateCredential('accessKeyId', e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.secretKey}</label>
              <input
                type="password"
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                value={newDest.credentials?.secretAccessKey || ''}
                onChange={e => updateCredential('secretAccessKey', e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.region}</label>
              {newDest.type === DestinationType.WASABI ? (
                <select
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none app-select"
                  value={newDest.credentials?.region || ''}
                  onChange={e => updateCredential('region', e.target.value)}
                >
                  <option value="">Select Region</option>
                  {WASABI_REGIONS.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                  placeholder="us-east-1"
                  value={newDest.credentials?.region || ''}
                  onChange={e => updateCredential('region', e.target.value)}
                />
              )}
            </div>
            {(newDest.type === DestinationType.WASABI || newDest.type === DestinationType.DIGITALOCEAN || newDest.type === DestinationType.BACKBLAZE) && (
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-1">{t.destinations.endpoint}</label>
                <input
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                  placeholder="s3.wasabisys.com"
                  value={newDest.credentials?.endpoint || ''}
                  onChange={e => updateCredential('endpoint', e.target.value)}
                />
              </div>
            )}
          </>
        );

      case DestinationType.AZURE:
        return (
          <>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.containerName}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                value={newDest.pathOrBucket}
                onChange={e => setNewDest({ ...newDest, pathOrBucket: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.connectionString}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                type="password"
                value={newDest.credentials?.connectionString || ''}
                onChange={e => updateCredential('connectionString', e.target.value)}
              />
            </div>
          </>
        );

      case DestinationType.GOOGLE_DRIVE:
        return (
          <>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.clientId}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                value={newDest.credentials?.clientId || ''}
                onChange={e => updateCredential('clientId', e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.clientSecret}</label>
              <input
                type="password"
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                value={newDest.credentials?.clientSecret || ''}
                onChange={e => updateCredential('clientSecret', e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.folderId}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                value={newDest.pathOrBucket}
                onChange={e => setNewDest({ ...newDest, pathOrBucket: e.target.value })}
              />
            </div>
          </>
        );

      case DestinationType.FTP:
        return (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.host}</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                  placeholder="ftp.example.com"
                  value={newDest.credentials?.host || ''}
                  onChange={e => updateCredential('host', e.target.value)}
                />
                <input
                  className="w-24 bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                  placeholder="21"
                  value={newDest.credentials?.port || ''}
                  onChange={e => updateCredential('port', e.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.user}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                value={newDest.credentials?.user || ''}
                onChange={e => updateCredential('user', e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.password}</label>
              <input
                type="password"
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                value={newDest.credentials?.password || ''}
                onChange={e => updateCredential('password', e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.path}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                value={newDest.pathOrBucket}
                onChange={e => setNewDest({ ...newDest, pathOrBucket: e.target.value })}
              />
            </div>
          </>
        );

      case DestinationType.NETWORK:
        return (
          <>
            <div className="md:col-span-3">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.networkPath}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none font-mono"
                placeholder="\\192.168.1.50\Backups"
                value={newDest.pathOrBucket}
                onChange={e => setNewDest({ ...newDest, pathOrBucket: e.target.value })}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.user}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                placeholder="DOMAIN\User"
                value={newDest.credentials?.user || ''}
                onChange={e => updateCredential('user', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.password}</label>
              <input
                type="password"
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                value={newDest.credentials?.password || ''}
                onChange={e => updateCredential('password', e.target.value)}
              />
            </div>
          </>
        );

      case DestinationType.LOCAL:
      default:
        return (
          <div className="md:col-span-3">
            <label className="block text-sm text-slate-400 mb-1">{t.destinations.path}</label>
            <div className="flex space-x-2">
              <input
                className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                placeholder="C:/Backups"
                value={newDest.pathOrBucket}
                onChange={e => setNewDest({ ...newDest, pathOrBucket: e.target.value })}
              />
                <button 
                  onClick={handleNativeBrowse}
                  className="app-select flex items-center justify-center aspect-square"
                  title="Abrir Windows Explorer"
                >
                    <Search size={18} />
                </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div>
      {/* File Browser Modal */}
      

      {/* Mount/Map Drive Modal */}
      {mountModalDest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80]">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-600 shadow-2xl max-w-lg w-full relative">
            <button
              onClick={() => setMountModalDest(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-600/20 rounded-full text-blue-400">
                <Network size={32} />
              </div>
              <h3 className="text-xl font-bold">{t.destinations.mapDriveTitle}</h3>
            </div>

            <p className="text-slate-300 mb-6 text-sm leading-relaxed">
              {t.destinations.mapDriveDesc}
            </p>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-700 font-mono text-xs text-green-400 mb-6">
              <p className="mb-2 text-slate-500 border-b border-slate-800 pb-1">Mount Configuration:</p>
              <p>Target: {mountModalDest.name}</p>
              <p>Type: {getProviderName(mountModalDest.type)}</p>
              <p>Bucket: {mountModalDest.pathOrBucket}</p>
              <p className="mt-2 text-yellow-300"># CloudGuard Agent required to mount as local disk</p>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 text-center">
                Escolha a letra da unidade
              </label>
              <div className="flex flex-wrap justify-center gap-2">
                {DRIVE_LETTERS.map(L => (
                  <button
                    key={L}
                    onClick={() => setSelectedLetter(L)}
                    className={`w-10 h-10 rounded-lg font-bold transition-all border ${
                      selectedLetter === L 
                        ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {L}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => handleDownloadOneClickScript(mountModalDest, selectedLetter)}
                className="group relative w-full overflow-hidden rounded-2xl p-[1px] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-blue-900/20"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 bg-[length:200%_100%] animate-shimmer" />
                <div className="relative flex flex-col items-center justify-center gap-3 bg-slate-900/90 py-6 px-4 rounded-2xl backdrop-blur-xl group-hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                        <CheckCircle size={28} />
                     </div>
                     <span className="text-xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        ATIVAR DISCO VIRTUAL
                     </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium px-4 text-center leading-relaxed max-w-sm">
                    O script será configurado automaticamente para a unidade <span className="text-blue-400 font-bold">{selectedLetter}:</span> e ficará pronto para uso em um clique.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold">{t.destinations.title}</h2>
            <button
                onClick={handleSetupRclone}
                disabled={isInstalling}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${isInstalling ? 'bg-amber-900/40 text-amber-500 border-amber-500/30' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-amber-500 hover:text-amber-400'}`}
                title="Configurar Rclone nesta máquina"
            >
                {isInstalling ? <Loader2 size={12} className="animate-spin" /> : <Server size={12} />}
                {isInstalling ? 'Instalando Rclone...' : 'Configurar Rclone Automagicamente'}
            </button>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all hover:shadow-lg hover:shadow-blue-900/40"
          >
            <Plus size={18} />
            <span>{t.destinations.add}</span>
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-slate-800/80 backdrop-blur p-6 rounded-xl border border-slate-700/50 mb-6 animate-fade-in shadow-xl">
          <h3 className="font-semibold mb-4 text-lg text-blue-400">
            {newDest.id ? t.destinations.edit : t.destinations.configure}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Common Fields */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.provider}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProviderSelect(!showProviderSelect)}
                  className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none flex items-center justify-between text-left"
                >
                  <span className="truncate">{newDest.type ? getProviderName(newDest.type as DestinationType) : ''}</span>
                  <ChevronDown size={16} className={`transition-transform ${showProviderSelect ? 'rotate-180' : ''}`} />
                </button>

                {showProviderSelect && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[70] py-1 max-h-60 overflow-y-auto custom-scrollbar">
                    {Object.values(DestinationType).map(dt => {
                      const isEnabled = [
                        DestinationType.LOCAL, 
                        DestinationType.WASABI, 
                        DestinationType.NETWORK,
                        DestinationType.AWS,
                        DestinationType.DIGITALOCEAN,
                        DestinationType.BACKBLAZE,
                        DestinationType.GOOGLE
                      ].includes(dt);
                      return (
                        <button
                          key={dt}
                          type="button"
                          disabled={!isEnabled}
                          onClick={() => {
                            setNewDest({ ...newDest, type: dt, credentials: {} });
                            setShowProviderSelect(false);
                          }}
                          className={`w-full px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                            isEnabled 
                              ? 'hover:bg-blue-600 text-white' 
                              : 'text-slate-500 cursor-not-allowed opacity-60'
                          } ${newDest.type === dt ? 'bg-blue-600/20 text-blue-400' : ''}`}
                          title={!isEnabled ? t.destinations.comingSoon : ''}
                        >
                          <span className="truncate">{getProviderName(dt)}</span>
                          {!isEnabled && <Lock size={12} className="shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {showProviderSelect && (
                  <div 
                    className="fixed inset-0 z-[65]" 
                    onClick={() => setShowProviderSelect(false)}
                  />
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-1">{t.destinations.friendlyName}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-blue-500 outline-none"
                placeholder="My Backup Target"
                value={newDest.name}
                onChange={e => setNewDest({ ...newDest, name: e.target.value })}
              />
            </div>

            {/* Dynamic Fields */}
            {renderSpecificFields()}

          </div>

          {testResult && (
            <div className={`mt-4 p-3 rounded-lg flex items-start gap-3 border ${testResult.success ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : 'bg-red-900/30 border-red-500/30 text-red-400'}`}>
               <div className="mt-0.5">
                  {testResult.success ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}
               </div>
               <div>
                  <p className="text-xs font-bold uppercase tracking-tight">{testResult.success ? t.destinations.testSuccess : t.destinations.testFailed}</p>
                  <p className="text-[11px] opacity-80">{testResult.message}</p>
               </div>
               <button onClick={() => setTestResult(null)} className="ml-auto text-slate-500 hover:text-white"><X size={14}/></button>
            </div>
          )}

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-700/50">
            <button 
              onClick={() => handleTest(newDest)} 
              disabled={!!testingId}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase border transition-all ${testingId === 'new' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-blue-600/10 text-blue-400 border-blue-500/30 hover:bg-blue-600/20'}`}
            >
              {testingId === 'new' ? <Loader2 size={14} className="animate-spin" /> : <Server size={14} />}
              {t.destinations.testConnectivity}
            </button>
            <div className="space-x-3">
              <button onClick={resetForm} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">{t.destinations.cancel}</button>
              <button onClick={handleSave} className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded text-white transition-colors font-medium">{t.destinations.save}</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {destinations.map(dest => (
          <div key={dest.id} className="bg-slate-800/50 backdrop-blur p-6 rounded-xl border border-slate-700/50 hover:border-blue-500 transition-all group hover:shadow-lg hover:shadow-blue-900/10">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-700/50 rounded-lg group-hover:bg-blue-900 group-hover:text-blue-200 transition-colors">
                {dest.type === DestinationType.LOCAL ? <HardDrive size={24} /> :
                  dest.type === DestinationType.NETWORK ? <Network size={24} /> :
                  dest.type === DestinationType.FTP ? <Server size={24} /> : <Cloud size={24} />}
              </div>
              <div className="flex space-x-1">
                {dest.type !== DestinationType.LOCAL && dest.type !== DestinationType.FTP && (
                  <button
                    onClick={() => setMountModalDest(dest)}
                    className="p-2 text-slate-500 hover:text-green-400 hover:bg-green-900/20 rounded transition-colors"
                    title={t.destinations.mapDrive}
                  >
                    <Network size={16} />
                  </button>
                )}
                <button 
                  onClick={() => handleTest(dest)} 
                  disabled={!!testingId}
                  className={`p-2 rounded transition-colors ${testingId === dest.id ? 'text-amber-400 bg-amber-900/40' : 'text-slate-500 hover:text-amber-400 hover:bg-amber-900/20'}`} 
                  title={t.destinations.testConnection}
                >
                  {testingId === dest.id ? <Loader2 size={16} className="animate-spin" /> : <Server size={16} />}
                </button>
                <button onClick={() => handleEdit(dest)} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-colors" title={t.jobs.edit}>
                  <Edit size={16} />
                </button>
                <button onClick={() => onDelete(dest.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-900/20 rounded transition-colors" title={t.jobs.delete}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h3 className="font-bold text-lg mb-1">{dest.name}</h3>
            <p className="text-blue-400 text-sm font-medium mb-3">{getProviderName(dest.type)}</p>

            <div className="space-y-1">
              <p className="text-slate-400 text-xs font-mono bg-slate-900 p-2 rounded border border-slate-800 truncate" title={dest.pathOrBucket}>
                {dest.pathOrBucket}
              </p>
              {dest.credentials?.region && (
                <p className="text-slate-500 text-xs px-1">Region: {dest.credentials.region}</p>
              )}
            </div>

            {/* Quick Test Feedback for Cards */}
            {testResult && testResult.id === dest.id && testingId !== dest.id && (
                <div className="mt-3 py-1.5 px-3 bg-slate-900 rounded border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    {testResult.success ? <CheckCircle size={12} className="text-emerald-500" /> : <AlertTriangle size={12} className="text-red-500" />}
                    <span className={`text-[10px] font-bold truncate ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {testResult.message}
                    </span>
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Destinations;