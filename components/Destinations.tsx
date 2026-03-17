
import React, { useState } from 'react';
import { Destination, DestinationType, Language } from '../types';
import { Plus, Trash2, Cloud, Search, Edit, HardDrive, Server, Network, Download, X, Lock, ChevronDown } from 'lucide-react';
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

            <div className="flex flex-col gap-3">
              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded flex items-center justify-center gap-2 transition-all">
                <Download size={18} />
                {t.destinations.downloadAgent}
              </button>
              <button className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded text-sm">
                {t.destinations.copyCommand}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{t.destinations.title}</h2>
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
                      const isEnabled = dt === DestinationType.LOCAL || dt === DestinationType.WASABI || dt === DestinationType.NETWORK;
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

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-700/50">
            <button onClick={resetForm} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">{t.destinations.cancel}</button>
            <button onClick={handleSave} className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded text-white transition-colors font-medium">{t.destinations.save}</button>
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
          </div>
        ))}
      </div>
    </div>
  );
};

export default Destinations;